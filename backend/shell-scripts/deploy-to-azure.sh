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
   echo "Azure CLI not found. Please install it first: https://docs.microsoft.com/cli/azure/install-azure-cli"
   exit 1
fi

# Login to Azure if not already logged in
az account show &> /dev/null || az login

# Generate timestamp for revision suffix
REVISION_SUFFIX="local-$(date +%Y%m%d%H%M%S)"

echo "Enter which app you would like to deploy (web | scraper | discord | all)"
read app_name
[ -z "$app_name" ] && { echo "Error: No input provided"; exit 1; }

# Utility: make a valid secret name
convert_to_secret_ref() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | tr '_' '-'
}

# Load and process .env
if [ ! -f "$ENV_FILE" ]; then
   echo "⚠️ Warning: Missing $ENV_FILE"
   echo "Continue without env vars? (y/n)"
   read ok && [ "$ok" != "y" ] && exit 1
   ENV_VARS=""
else
   echo "🔐 Loading and registering all .env entries as secrets..."
   ENV_VARS=""
   SECRET_REFS=()
   SECRET_COUNT=0

   while IFS= read -r line || [ -n "$line" ]; do
     [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
     KEY="${line%%=*}"
     VALUE="${line#*=}"
     # strip quotes
     VALUE="${VALUE%\"}"; VALUE="${VALUE#\"}"
     VALUE="${VALUE%\'}"; VALUE="${VALUE#\'}"

     SECRET_REF=$(convert_to_secret_ref "$KEY")
     SECRET_REFS+=("$KEY:$SECRET_REF")
     SECRET_COUNT=$((SECRET_COUNT+1))

     ENV_VARS+="--set-env-vars $KEY=secretref:$SECRET_REF "
     echo "  ✔ $KEY → secretref:$SECRET_REF"
   done < "$ENV_FILE"

   # always include this
   ENV_VARS+="--set-env-vars REVISION_MODE=single "
fi

# update_secrets: push each mapping into Azure
update_secrets() {
  local app=$1
  if [ $SECRET_COUNT -gt 0 ]; then
    echo "Updating $SECRET_COUNT secrets for $app..."
    SECRETS_CMD=""
    for mapping in "${SECRET_REFS[@]}"; do
      K="${mapping%%:*}"
      R="${mapping#*:}"
      V=$(grep "^$K=" "$ENV_FILE" | cut -d'=' -f2- | sed -e 's/^["'\'']//;s/["'\'']$//')
      SECRETS_CMD+="$R=$V "
    done
    az containerapp secret set --name "$app" --resource-group "$RESOURCE_GROUP" --secrets $SECRETS_CMD \
      && echo "  ✅ secrets updated for $app" \
      || { echo "  ❌ failed updating secrets for $app"; return 1; }
  fi
}

# deploy_app: update image, apply secrets & env
deploy_app() {
  local app=$1
  local image="$ACR_NAME/backend-$app:latest"
  echo "➡️ Deploying $app from $image"
  update_secrets "$app" || return 1

  az containerapp update \
    --name "$app" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$image" \
    --revision-suffix "$REVISION_SUFFIX" \
    $ENV_VARS \
    && echo "  ✅ $app updated" \
    || { echo "  ❌ failed updating $app"; return 1; }

  if [ "$app" = "$WEB_APP" ]; then
    echo "  ↪️ Setting 100% traffic to new web revision..."
    rev=$(az containerapp revision list \
      --name "$app" \
      --resource-group "$RESOURCE_GROUP" \
      --query "[?contains(name, '$REVISION_SUFFIX')].name" -o tsv)
    az containerapp ingress traffic set \
      --name "$app" \
      --resource-group "$RESOURCE_GROUP" \
      --revision-weight "$rev=100"
    url=$(az containerapp show \
      --name "$app" \
      --resource-group "$RESOURCE_GROUP" \
      --query "properties.configuration.ingress.fqdn" -o tsv)
    echo "  🌐 Web URL: https://$url"
  fi
}

# Main dispatcher
case "$app_name" in
  all)    deploy_app "$WEB_APP" && deploy_app "$SCRAPER_APP" && deploy_app "$DISCORD_APP" ;;
  web|scraper|discord) deploy_app "$app_name" ;;
  *) echo "Unknown: $app_name (valid: web, scraper, discord, all)"; exit 1 ;;
esac

echo "✅ Deployment complete!"
