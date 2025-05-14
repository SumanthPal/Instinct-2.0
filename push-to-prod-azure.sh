# Update all three services
docker build -t instinctregistry.azurecr.io/backend-web:latest -f Dockerfile.base .
docker build -t instinctregistry.azurecr.io/backend-scraper:latest -f Dockerfile.scraper .
docker build -t instinctregistry.azurecr.io/backend-discord:latest -f Dockerfile.base .

docker push instinctregistry.azurecr.io/backend-web:latest
docker push instinctregistry.azurecr.io/backend-scraper:latest
docker push instinctregistry.azurecr.io/backend-discord:latest

az containerapp update --name web --resource-group instinct \
  --image instinctregistry.azurecr.io/backend-web:latest \
  --command '["python", "app/server.py"]'

az containerapp update --name scraper --resource-group instinct \
  --image instinctregistry.azurecr.io/backend-scraper:latest \
  --command '["python", "app/tools/scraper_rotation.py"]'

az containerapp update --name discord --resource-group instinct \
  --image instinctregistry.azurecr.io/backend-discord:latest \
  --command '["python", "app/tools/discord_bot.py"]'