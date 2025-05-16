#!/bin/bash

ENV_FILE="./backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

ENV_VARS=""

while IFS= read -r line || [ -n "$line" ]; do
  # Skip comments and empty lines
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

  # Split key=value
  KEY=$(echo "$line" | cut -d '=' -f1)
  VALUE=$(echo "$line" | cut -d '=' -f2-)

  # Remove surrounding quotes (single or double)
  VALUE=$(echo "$VALUE" | sed -e 's/^["'\'']//;s/["'\'']$//')

  ENV_VARS+="--env $KEY=$VALUE "
done < "$ENV_FILE"

echo "Running with env vars:"
echo "$ENV_VARS"

echo "Enter image: instinct-(web | scraper | discord)"
read image
docker run -it --rm $ENV_VARS $image
