#!/bin/bash
# push-to-azure.sh - Push locally built images to Azure Container Registry

# Azure settings
ACR_NAME="instinctregistry.azurecr.io"
RESOURCE_GROUP="instinct"

# Login to Azure if not already logged in
az account show &> /dev/null || az login

# Login to ACR
echo "Logging in to Azure Container Registry ($ACR_NAME)..."
az acr login --name $(echo $ACR_NAME | cut -d. -f1)

if [ $? -ne 0 ]; then
    echo "❌ Failed to log in to Azure Container Registry. Please check your credentials."
    exit 1
fi

echo "Enter which image you would like to push (web | scraper | discord | all)"
read command

# Check if input is empty
if [ -z "$command" ]; then
    echo "Error: No input provided"
    exit 1
fi

# Function to push a specific image
push_image() {
    local type=$1
    local local_tag="instinct-$type"
    local acr_tag="$ACR_NAME/backend-$type:latest"
    
    echo "Pushing $type image to Azure Container Registry..."
    
    # Check if local image exists
    if ! docker image inspect $local_tag &> /dev/null; then
        echo "❌ Local image $local_tag not found. Please build it first using build.sh."
        return 1
    fi
    
    # Tag the image for ACR
    echo "Tagging $local_tag as $acr_tag..."
    docker tag $local_tag $acr_tag
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to tag image $local_tag as $acr_tag"
        return 1
    fi
    
    # Push to ACR
    echo "Pushing $acr_tag to Azure Container Registry..."
    docker push $acr_tag
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully pushed $acr_tag to Azure Container Registry"
    else
        echo "❌ Failed to push $acr_tag to Azure Container Registry"
        return 1
    fi
    
    return 0
}

# Push images based on the command
if [ "$command" == "all" ]; then
    push_image "web" && push_image "scraper" && push_image "discord"
elif [ "$command" == "web" ] || [ "$command" == "scraper" ] || [ "$command" == "discord" ]; then
    push_image "$command"
else 
    echo "Unknown command: $command"
    echo "Valid options are: web, scraper, discord, all"
    exit 1
fi

echo "✅ Image push completed. You can now deploy using deploy-to-azure.sh"
