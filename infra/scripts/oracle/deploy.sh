#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-}"
APP_DIR="${APP_DIR:-/opt/sports}"
BRANCH="${BRANCH:-main}"

if [ -z "$REPO_URL" ]; then
  echo "Set REPO_URL before running (example: git@github.com:you/repo.git)." >&2
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER":"$USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch --all --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f .env.production ]; then
  echo ".env.production is missing in $APP_DIR" >&2
  echo "Copy .env.production.example to .env.production and fill real values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.production
set +a

docker compose -f infra/docker/docker-compose.oracle.yml run --rm migrate
docker compose -f infra/docker/docker-compose.oracle.yml up -d --build api worker caddy
docker compose -f infra/docker/docker-compose.oracle.yml ps
