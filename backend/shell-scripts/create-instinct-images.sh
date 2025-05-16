#!/bin/bash

# build.sh - Build Docker images for both local development and Azure deployment

# First, make sure buildx is available and set up correctly
if ! docker buildx ls | grep -q mybuilder; then
    echo "Setting up Docker buildx builder..."
    docker buildx create --name mybuilder --use
else
    docker buildx use mybuilder
fi

echo "Enter which image you would like to build (web | scraper | discord | all)"
read command

# Check if input is empty
if [ -z "$command" ]; then
    echo "Error: No input provided"
    exit 1
fi

# Function to build a specific image
build_image() {
    local type=$1
    local dockerfile="./backend/Dockerfile.$type"
    local tag="instinct-$type"
    
    echo "Building $type image for linux/amd64 platform..."
    
    # Use buildx to create a multi-platform image
    docker buildx build \
        --platform linux/amd64 \
        -f $dockerfile \
        -t $tag \
        --load \
        .
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully built $tag image"
    else
        echo "❌ Failed to build $tag image"
        exit 1
    fi
}

# Build images based on the command
if [ "$command" == "all" ]; then
    build_image "scraper"
    build_image "web"
    build_image "discord"
elif [ "$command" == "scraper" ] || [ "$command" == "web" ] || [ "$command" == "discord" ]; then
    build_image "$command"
else 
    echo "Unknown command: $command"
    echo "Valid options are: web, scraper, discord, all"
    exit 1
fi

echo "Done! Images are ready for local use."
echo "To push to Azure Container Registry, you can use:"
echo "  docker tag instinct-$command yourregistry.azurecr.io/instinct-$command:latest"
echo "  docker push yourregistry.azurecr.io/instinct-$command:latest"