#!/bin/sh
set -eu

attempt=1
max_attempts=12

while [ "$attempt" -le "$max_attempts" ]; do
  echo "Running prisma migrate deploy (attempt $attempt/$max_attempts)"
  if pnpm exec prisma migrate deploy; then
    exec node dist/main.js
  fi

  if [ "$attempt" -eq "$max_attempts" ]; then
    echo "Prisma migrate deploy failed after $max_attempts attempts"
    exit 1
  fi

  echo "Database not ready yet; retrying in 5 seconds"
  attempt=$((attempt + 1))
  sleep 5
done
