#!/bin/bash
set -e

echo "=== CONTAINER STARTUP ==="
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la
echo "Python version: $(python --version)"
echo "Environment variables:"
env | grep -v PASSWORD | grep -v SECRET | sort
echo "=== STARTING APPLICATION ==="

exec "$@"
