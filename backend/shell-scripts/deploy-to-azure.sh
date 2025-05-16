#!/bin/bash
# deploy-to-azure.sh - Deploy images from ACR to Azure Container Apps with secrets

# Azure settings
ACR_NAME="instinctregistry.azurecr.io"
RESOURCE_GROUP="instinct"
REGION="westus"
WEB_APP="web"
SCRAPER_APP="scraper"
DISCORD_APP="discord"
ENV_FILE="./backend/.env"

# Check if az cli is installed
if ! command -v az &> /dev/null; then
    echo "Azure CLI not found. Please install it first: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Login to Azure if not already logged in
az account show &> /dev/null || az login

# Generate timestamp for revision suffix
REVISION_SUFFIX="local-$(date +%Y%m%d%H%M%S)"

echo "Enter which app you would like to deploy (web | scraper | discord | all)"
read app_name

# Check if input is empty
if [ -z "$app_name" ]; then
    echo "Error: No input provided"
    exit 1
fi

# Verify the .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️ Warning: Missing $ENV_FILE"
    echo "Would you like to continue without environment variables? (y/n)"
    read continue_without_env
    
    if [ "$continue_without_env" != "y" ]; then
        echo "Exiting."
        exit 1
    fi
    
    # Set to empty if continuing without .env
    ENV_VARS=""
else
    # Load environment variables to pass to container apps
    ENV_VARS=""
    SECRETS_JSON="["
    SECRET_COUNT=0
    
    echo "Processing environment variables from $ENV_FILE..."
    
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
        
        # Split key=value
        KEY=$(echo "$line" | cut -d '=' -f1)
        VALUE=$(echo "$line" | cut -d '=' -f2-)
        
        # Remove surrounding quotes (single or double)
        VALUE=$(echo "$VALUE" | sed -e 's/^["'\'']//;s/["'\'']$//')
        
        # Check if value is sensitive (contains password, key, token, secret)
        if [[ "$KEY" =~ .*(PASSWORD|KEY|TOKEN|SECRET|APIKEY|JWT).* || "$KEY" =~ .*(Password|Key|Token|Secret|ApiKey|Jwt).* ]]; then
            # Add as a secret
            if [ $SECRET_COUNT -gt 0 ]; then
                SECRETS_JSON="$SECRETS_JSON,"
            fi
            SECRETS_JSON="$SECRETS_JSON{\"name\":\"$KEY\",\"value\":\"$VALUE\"}"
            SECRET_COUNT=$((SECRET_COUNT+1))
            
            # Reference the secret in the env vars
            ENV_VARS+="--set-env-vars $KEY=secretref:$KEY "
        else
            # Regular environment variable
            ENV_VARS+="--set-env-vars $KEY=$VALUE "
        fi
    done < "$ENV_FILE"
    
    SECRETS_JSON="$SECRETS_JSON]"
    
    # Add revision mode to environment variables
    ENV_VARS+="--set-env-vars REVISION_MODE=single "
fi

# Function to update secrets for an app
update_secrets() {
    local app=$1
    
    # Only update secrets if we have any
    if [ $SECRET_COUNT -gt 0 ]; then
        echo "Updating secrets for $app..."
        
        # Create a temporary file for the secrets JSON
        SECRETS_FILE=$(mktemp)
        echo $SECRETS_JSON > $SECRETS_FILE
        
        # Update the secrets
        az containerapp secret set --name $app --resource-group $RESOURCE_GROUP --secrets @$SECRETS_FILE
        
        # Remove temporary file
        rm $SECRETS_FILE
        
        if [ $? -ne 0 ]; then
            echo "❌ Failed to update secrets for $app"
            return 1
        fi
        
        echo "✅ Successfully updated secrets for $app"
    else
        echo "No secrets to update for $app"
    fi
    
    return 0
}

# Function to deploy a specific app
deploy_app() {
    local app=$1
    local image="$ACR_NAME/backend-$app:latest"
    
    echo "Deploying $app from $image..."
    
    # First update the secrets (if any)
    update_secrets $app
    
    # Then update the container app
    echo "Updating container app $app with revision suffix $REVISION_SUFFIX..."
    az containerapp update --name $app --resource-group $RESOURCE_GROUP \
        --image $image \
        --revision-suffix $REVISION_SUFFIX \
        $ENV_VARS
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to update container app $app"
        return 1
    fi
    
    echo "✅ Successfully updated container app $app"
    
    # Wait for the revision to be created
    echo "Waiting for revision to be created..."
    local retry=0
    local revision=""
    while [ -z "$revision" ] && [ $retry -lt 12 ]; do
        sleep 5
        revision=$(az containerapp revision list --name $app --resource-group $RESOURCE_GROUP --query "[?contains(name, '$REVISION_SUFFIX')].name" -o tsv)
        retry=$((retry+1))
        echo "Checking revision (attempt $retry/12)..."
    done
    
    if [ -z "$revision" ]; then
        echo "⚠️ Warning: Could not find revision with suffix $REVISION_SUFFIX for $app"
        return 0
    fi
    
    echo "Revision $revision created for $app"
    
    # Set traffic to the new revision
    echo "Setting 100% traffic to $revision..."
    az containerapp ingress traffic set --name $app --resource-group $RESOURCE_GROUP \
        --revision-weight "$revision=100"
    
    if [ $? -ne 0 ]; then
        echo "⚠️ Warning: Failed to set traffic to revision $revision"
    else
        echo "✅ Successfully set 100% traffic to revision $revision"
    fi
    
    # Get and display the URL if it's the web app
    if [ "$app" == "$WEB_APP" ]; then
        local url=$(az containerapp show --name $app --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)
        if [ -n "$url" ]; then
            echo "🌐 Web app URL: https://$url"
        fi
    fi
    
    return 0
}

# Deploy apps based on user input
if [ "$app_name" == "all" ]; then
    deploy_app "$WEB_APP" && deploy_app "$SCRAPER_APP" && deploy_app "$DISCORD_APP"
elif [ "$app_name" == "web" ]; then
    deploy_app "$WEB_APP"
elif [ "$app_name" == "scraper" ]; then
    deploy_app "$SCRAPER_APP"
elif [ "$app_name" == "discord" ]; then
    deploy_app "$DISCORD_APP"
else 
    echo "Unknown app name: $app_name"
    echo "Valid options are: web, scraper, discord, all"
    exit 1
fi

echo "✅ Deployment completed!"