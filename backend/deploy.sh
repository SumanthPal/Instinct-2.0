#!/usr/bin/env bash
set -euo pipefail
source .env
# ─── 0. CONFIGURE THESE ──────────────────────────────────────────────────────
export RG="instinct"                         # resource group
export LOCATION="westus"                    # your preferred Azure region
export ACR="instinctregistry"               # must be globally unique
export CA_ENV="instinctenv"                # Container Apps environment
export IMAGE_PREFIX="$ACR.azurecr.io"       
export ACR_PASSWORD="$(az acr credential show \
  --name instinctregistry \
  --resource-group instinct \
  --query 'passwords[0].value' \
  -o tsv)"


# ─── 1. CREATE INFRA ─────────────────────────────────────────────────────────
# echo "👉 Creating resource group…"
# az group create \
#   --name "$RG" \
#   --location "$LOCATION"

# echo "👉 Creating ACR…"
# az acr create \
#   --resource-group "$RG" \
#   --name "$ACR" \
#   --sku Basic \
#   --admin-enabled true

# # ─── 2. BUILD & PUSH IMAGES ──────────────────────────────────────────────────
# echo "👉 Logging in to ACR…"
# az acr login --name "$ACR"

# echo "👉 Building & pushing backend-web…"
# docker build -f Dockerfile.base -t "$IMAGE_PREFIX/backend-web:latest" .
# docker push "$IMAGE_PREFIX/backend-web:latest"

# echo "👉 Building & pushing backend-scraper…"
# docker build -f Dockerfile.scraper -t "$IMAGE_PREFIX/backend-scraper:latest" .
# docker push "$IMAGE_PREFIX/backend-scraper:latest"

# echo "👉 Building & pushing backend-discord…"
# docker build -f Dockerfile.base -t "$IMAGE_PREFIX/backend-discord:latest" .
# docker push "$IMAGE_PREFIX/backend-discord:latest"

# ─── 3. CONTAINER APPS ENV ────────────────────────────────────────────────────
# echo "👉 Creating Container Apps environment…"
# az containerapp env create \
#   --name "$CA_ENV" \
#   --resource-group "$RG" \
#   --location "$LOCATION"

# ─── 4. REGISTER SECRETS ─────────────────────────────────────────────────────
# Assumes you’ve exported these in your shell from .env:
#   export SUPABASE_URL=…
#   export SUPABASE_KEY=…
#   export REDIS_URL=…
#   export OPENAI=…
#   export DISCORD_TOKEN=
# 4. DEPLOY WEB (no secrets yet)
echo "👉 Deploying web container app…"
az containerapp create \
  --name web \
  --resource-group "$RG" \
  --environment "$CA_ENV" \
  --image "$IMAGE_PREFIX/backend-web:latest" \
  --ingress external \
  --target-port 8000 \
  --registry-server "$IMAGE_PREFIX" \
  --registry-username "$ACR" \
  --registry-password "$ACR_PASSWORD" \
  --command "python" \
  --args "app/server.py" \
  --env-vars ENV=production

# 5. NOW you can register secrets against that app
echo "👉 Creating secrets in Container Apps…"
az containerapp secret set \
  --name web \
  --resource-group "$RG" \
  --secrets \
      SUPABASE_URL="$SUPABASE_URL" \
      SUPABASE_KEY="$SUPABASE_KEY" \
      REDIS_URL="$REDIS_URL" \
      OPENAI="$OPENAI" 

# 6. And finally bind those secrets as env‐vars
az containerapp update \
  --name web \
  --resource-group "$RG" \
  --set-env-vars \
     SUPABASE_URL=secretref:SUPABASE_URL \
     SUPABASE_KEY=secretref:SUPABASE_KEY \
     REDIS_URL=secretref:REDIS_URL \
     OPENAI=secretref:OPENAI 


echo "👉 Deploying scraper container app…"
az containerapp create \
  --name scraper \
  --resource-group "$RG" \
  --environment "$CA_ENV" \
  --image "$IMAGE_PREFIX/backend-scraper:latest" \
  --registry-server "$IMAGE_PREFIX" \
  --registry-username "$ACR" \
  --registry-password "$(az acr credential show --name $ACR --query 'passwords[0].value' -o tsv)" \
  --command "python" \
  --args "app/tools/scraper_rotation.py" \
  --env-vars \
     ENV=production \
     SUPABASE_URL=secretref:SUPABASE_URL \
     SUPABASE_KEY=secretref:SUPABASE_KEY \
     REDIS_URL=secretref:REDIS_URL

echo "👉 Deploying discord bot container app…"
az containerapp create \
  --name discord \
  --resource-group "$RG" \
  --environment "$CA_ENV" \
  --image "$IMAGE_PREFIX/backend-discord:latest" \
  --registry-server "$IMAGE_PREFIX" \
  --registry-username "$ACR" \
  --registry-password "$(az acr credential show --name $ACR --query 'passwords[0].value' -o tsv)" \
  --command "python" \
  --args "app/tools/discord_bot.py" \
  --env-vars \
     ENV=production \
     SUPABASE_URL=secretref:SUPABASE_URL \
     SUPABASE_KEY=secretref:SUPABASE_KEY \
     REDIS_URL=secretref:REDIS_URL
az containerapp create \
  --name web \
  --resource-group "$RG" \
  --environment "$CA_ENV" \
  --image "$IMAGE_PREFIX/backend-web:latest" \
  --ingress external \
  --target-port 8000 \
  --registry-server "$IMAGE_PREFIX" \
  --registry-username "$ACR" \
  --registry-password "$ACR_PASSWORD" \
  --command "python" \
  --args "app/server.py" \
  --env-vars ENV=production

az containerapp create \
  --name discord \
  --resource-group "$RG" \
  --environment "$CA_ENV" \
  --image "$IMAGE_PREFIX/backend-discord:latest" \
  --registry-server "$IMAGE_PREFIX" \
  --registry-username "$ACR" \
  --registry-password "$ACR_PASSWORD" \
  --cpu 0.5 \
  --memory 1.0Gi \
  --min-replicas 1 \
  --max-replicas 3 \
  --command "python" \
  --args "app/tools/discord_bot.py" \
  --env-vars ENV=production
# ─── 6. VERIFY ─────────────────────────────────────────────────────────────────
echo "✅ Deployment complete!"
echo "👉 Tail web logs with:"
echo "   az containerapp logs revision show --name web --resource-group $RG --container web --follow"
