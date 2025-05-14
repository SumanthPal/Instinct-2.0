#!/bin/bash
# Simplified script to configure ACR credentials for Container Apps

# Variables
RESOURCE_GROUP="instinct"
ACR_NAME="instinctregistry"
APP_NAME="scraper-new"  # Change to "scraper" if you want to fix the existing one

echo "=== CONFIGURING ACR CREDENTIALS FOR CONTAINER APP ==="
echo "Resource Group: $RESOURCE_GROUP"
echo "ACR Name: $ACR_NAME"
echo "App Name: $APP_NAME"
echo

# 1. Get ACR credentials
echo "Getting ACR credentials..."
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

if [ -z "$ACR_PASSWORD" ] || [ -z "$ACR_USERNAME" ]; then
  echo "❌ Failed to get ACR credentials. Check if ACR exists and you have permissions."
  exit 1
fi

echo "ACR Username: $ACR_USERNAME"
echo "ACR Password: [REDACTED]"

# 2. Update the Container App with registry credentials
echo "Updating Container App with registry credentials..."
az containerapp registry set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --server instinctregistry.azurecr.io \
  --username $ACR_USERNAME \
  --password $ACR_PASSWORD

echo "✅ Registry credentials configured successfully."

# 3. Test with nginx image first
echo "Testing Container App with public nginx image first..."
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image nginx:alpine \
  --cpu 1 \
  --memory 2Gi \
  --min-replicas 1

echo "Waiting 30 seconds for nginx deployment to stabilize..."
sleep 30

# 4. Check nginx deployment status
NGINX_STATUS=$(az containerapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.provisioningState" -o tsv)

echo "Nginx deployment status: $NGINX_STATUS"

if [ "$NGINX_STATUS" != "Succeeded" ]; then
  echo "❌ Nginx deployment failed. There might be other issues with the Container App."
  exit 1
fi

# 5. Update with ACR image
echo "Updating Container App to use ACR image..."
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image instinctregistry.azurecr.io/backend-scraper:latest \
  --cpu 1 \
  --memory 2Gi \
  --min-replicas 1 \
  --env-vars "PYTHONUNBUFFERED=1" "CHROME_BIN=/usr/bin/chromium" "CHROMEDRIVER_PATH=/usr/bin/chromedriver"

echo "Waiting 60 seconds for deployment to stabilize..."
sleep 60

# 6. Check final deployment status
echo -e "\n=== FINAL DEPLOYMENT STATUS ==="
az containerapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "{Name:name,ProvisioningState:properties.provisioningState}" \
  --output yaml

# 7. Get active revision and its status
echo -e "\n=== ACTIVE REVISION STATUS ==="
ACTIVE_REVISION=$(az containerapp revision list \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "[?properties.active==\`true\`].name" -o tsv)

if [ -n "$ACTIVE_REVISION" ]; then
  az containerapp revision show \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --revision "$ACTIVE_REVISION" \
    --query "{Status:properties.status,Error:properties.errorMessage}" \
    --output yaml
else
  echo "No active revision found."
fi

# 8. Get logs
echo -e "\n=== LOGS ==="
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --tail 20 || echo "No logs available"

echo -e "\n=== DONE ==="
echo "Container App configured with ACR credentials."
echo "If deployment succeeded, update your GitHub workflow to use this app."