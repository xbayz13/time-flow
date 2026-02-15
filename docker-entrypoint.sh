#!/bin/sh
set -e

echo "Waiting for database..."
until bun run db:connection-check 2>/dev/null; do
  sleep 2
done

echo "Pushing schema..."
bun run db:push || true

echo "Starting server..."
exec bun run src/index.ts
