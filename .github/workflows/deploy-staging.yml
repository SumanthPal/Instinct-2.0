name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:  # Allow manual trigger

env:
  ACR_NAME: instinctregistry.azurecr.io
  RESOURCE_GROUP: instinct
  WEB_APP: web2
  SCRAPER_APP: scraper
  DISCORD_APP: discord

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Azure
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    - name: Log in to ACR
      uses: docker/login-action@v3
      with:
        registry: ${{ env.ACR_NAME }}
        username: ${{ secrets.ACR_USERNAME }}
        password: ${{ secrets.ACR_PASSWORD }}

    - name: Build and push web image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./backend/Dockerfile.web
        push: true
        platforms: linux/amd64
        tags: |
          ${{ env.ACR_NAME }}/backend-web:latest

    - name: Build and push scraper image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./backend/Dockerfile.scraper
        push: true
        platforms: linux/amd64
        tags: |
          ${{ env.ACR_NAME }}/backend-scraper:latest

    - name: Build and push discord image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./backend/Dockerfile.discord
        push: true
        platforms: linux/amd64
        tags: |
          ${{ env.ACR_NAME }}/backend-discord:latest

    - name: Update Container Apps
      run: |
        echo "Updating Container Apps with new images..."
        
        # Update Web App (now web2)
        echo "Updating Web App (web2)..."
        az containerapp update \
          --name ${{ env.WEB_APP }} \
          --resource-group ${{ env.RESOURCE_GROUP }} \
          --image ${{ env.ACR_NAME }}/backend-web:latest
        
        # Update Scraper App
        echo "Updating Scraper App..."
        az containerapp update \
          --name ${{ env.SCRAPER_APP }} \
          --resource-group ${{ env.RESOURCE_GROUP }} \
          --image ${{ env.ACR_NAME }}/backend-scraper:latest
        
        # Update Discord App
        echo "Updating Discord App..."
        az containerapp update \
          --name ${{ env.DISCORD_APP }} \
          --resource-group ${{ env.RESOURCE_GROUP }} \
          --image ${{ env.ACR_NAME }}/backend-discord:latest

    - name: Wait for deployments
      run: |
        echo "Waiting for deployments to complete..."
        sleep 30
        
        # Check status of all apps
        echo "Checking deployment status..."
        az containerapp show --name ${{ env.WEB_APP }} --resource-group ${{ env.RESOURCE_GROUP }} --query "properties.latestRevisionName" -o tsv
        az containerapp show --name ${{ env.SCRAPER_APP }} --resource-group ${{ env.RESOURCE_GROUP }} --query "properties.latestRevisionName" -o tsv
        az containerapp show --name ${{ env.DISCORD_APP }} --resource-group ${{ env.RESOURCE_GROUP }} --query "properties.latestRevisionName" -o tsv

    - name: Create deployment summary
      run: |
        echo "## 🚀 Deployment Complete!" >> $GITHUB_STEP_SUMMARY
        echo "- **Commit**: ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
        echo "- **Timestamp**: $(date)" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        echo "### Updated Apps:" >> $GITHUB_STEP_SUMMARY
        echo "- ✅ Web App (web2)" >> $GITHUB_STEP_SUMMARY
        echo "- ✅ Scraper App" >> $GITHUB_STEP_SUMMARY
        echo "- ✅ Discord App" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        
        # Get app URLs
        WEB_URL=$(az containerapp show --name ${{ env.WEB_APP }} --resource-group ${{ env.RESOURCE_GROUP }} --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "Not available")
        if [[ "$WEB_URL" != "Not available" ]]; then
          echo "### 🌐 App URLs:" >> $GITHUB_STEP_SUMMARY
          echo "- **Web App**: https://$WEB_URL" >> $GITHUB_STEP_SUMMARY
        fi