#!/bin/bash
# This script will build and deploy a diagnostic container to Azure Container Apps
# to help debug why your application is failing to start.

# Set variables
ACR_NAME="instinctregistry.azurecr.io"
RESOURCE_GROUP="instinct"
WEB_APP="web"

# Login to Azure (if not already logged in)
echo "Logging in to Azure..."
az login

# Login to ACR
echo "Logging in to Azure Container Registry..."
az acr login --name ${ACR_NAME%%.*}

# Build the diagnostic container
echo "Building diagnostic container..."
docker build -t $ACR_NAME/backend-web:diagnostic -f Dockerfile.diagnostic .

# Push the diagnostic container
echo "Pushing diagnostic container to ACR..."
docker push $ACR_NAME/backend-web:diagnostic

# Deploy the diagnostic container
echo "Deploying diagnostic container to Azure Container App..."
az containerapp update --name $WEB_APP --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME/backend-web:diagnostic \
  --revision-suffix "diagnostic" \
  --command '["/app/diagnose.sh"]'

# Get the revision name
echo "Getting revision information..."
REVISION=$(az containerapp revision list --name $WEB_APP --resource-group $RESOURCE_GROUP --query "[?contains(name, 'diagnostic')].name" -o tsv)

# Show how to get logs
echo ""
echo "Diagnostic container deployed as revision: $REVISION"
echo "Wait a few moments for it to start, then check the logs with:"
echo "az containerapp logs show --name $WEB_APP --resource-group $RESOURCE_GROUP --revision $REVISION"
echo ""
echo "This diagnostic container will show the file structure and environment of your container."
echo "This should help identify why your container isn't starting correctly in Azure."