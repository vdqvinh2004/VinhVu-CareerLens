#!/bin/sh
set -e

echo "Running database migrations..."
node /app/docker/migrate.mjs

echo "Starting server..."
exec node server.js
