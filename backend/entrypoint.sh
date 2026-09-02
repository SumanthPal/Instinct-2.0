#!/bin/bash
set -e

echo "=== instinct container startup ==="
echo "python:  $(python --version 2>&1)"
echo "workdir: $(pwd)"
echo "command: $*"
echo "=================================="

# Deliberately does NOT dump the environment. It previously ran
#   env | grep -v PASSWORD | grep -v SECRET
# which still wrote OPENAI, INTERNAL_API_TOKEN, COOKIE_1/2 and
# GC_CREDENTIAL to container logs in cleartext.

exec "$@"
