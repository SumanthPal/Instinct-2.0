#!/bin/bash

# List of your Container Apps
APPS=("web" "scraper" "discord")

# Your Azure Resource Group
RG="instinct"

# Path to your .env file
ENV_FILE=".env"

# Fail if .env is missing
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found at $ENV_FILE"
  exit 1
fi

# Read each line of .env
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue

  secret_name=$(echo "$key" | tr '[:upper:]' '[:lower:]' | tr '_' '-')

  echo "🔐 Processing: $key → secret name: $secret_name"

  for app in "${APPS[@]}"; do
    echo "  ↳ Setting secret for $app"
    az containerapp secret set \
      --name "$app" \
      --resource-group "$RG" \
      --secrets "$secret_name=$value" >/dev/null

    echo "  ↳ Injecting env var $key=secretref:$secret_name"
    az containerapp update \
      --name "$app" \
      --resource-group "$RG" \
      --set-env-vars "$key=secretref:$secret_name" >/dev/null
  done
done < "$ENV_FILE"

echo "✅ All secrets and env vars pushed to web, scraper, and discord"
