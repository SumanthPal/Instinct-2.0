#!/bin/bash
# build-fixed.sh - Build Docker images with workaround for Chromium SSE3 issues

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
    
    # For scraper, we'll use a modified approach
    if [ "$type" == "scraper" ]; then
        echo "Using special build process for scraper to avoid Chromium SSE3 issues..."
        
        # Create a temporary Dockerfile without the version check commands
        TEMP_DOCKERFILE=$(mktemp)
        cat $dockerfile | grep -v "echo \"Installed Chrome version\"" | grep -v "echo \"Installed ChromeDriver version\"" | grep -v "echo \"Chrome binary location\"" | grep -v "echo \"ChromeDriver binary location\"" > $TEMP_DOCKERFILE
        
        # Use buildx with the temporary Dockerfile
        docker buildx build \
            --platform linux/amd64 \
            -f $TEMP_DOCKERFILE \
            -t $tag \
            --load \
            .
        
        # Remove temporary file
        rm $TEMP_DOCKERFILE
    else
        # Regular build for other images
        docker buildx build \
            --platform linux/amd64 \
            -f $dockerfile \
            -t $tag \
            --load \
            .
    fi
    
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
echo "  docker tag instinct-$command instinctregistry.azurecr.io/backend-$command:latest"
echo "  docker push instinctregistry.azurecr.io/backend-$command:latest"