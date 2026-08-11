#!/usr/bin/env bash
# Local dev startup for coach_me.
# - installs deps if needed
# - starts a local Postgres container if one isn't already running
# - runs Prisma migrations
# - starts `next dev`
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PG_CONTAINER_NAME="coach_me_postgres"
PG_PORT=5432

if [ ! -f .env.local ]; then
  echo "No .env.local found — copying from .env.local.example."
  cp .env.local.example .env.local
  echo "Edit .env.local (Claude auth, secrets) before continuing if needed."
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

# Prisma CLI only auto-loads `.env`, not `.env.local` (that's a Next.js-only
# convention) — export it into this script's environment so `prisma migrate`
# sees DATABASE_URL too. `next dev` still loads .env.local on its own.
set -a
# shellcheck disable=SC1091
source .env.local
set +a

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Install Docker, or point DATABASE_URL in .env.local at a Postgres instance you're running some other way." >&2
  exit 1
fi

if [ "$(docker inspect -f '{{.State.Running}}' "$PG_CONTAINER_NAME" 2>/dev/null || true)" = "true" ]; then
  echo "Postgres container '$PG_CONTAINER_NAME' already running."
elif docker inspect "$PG_CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Starting existing Postgres container '$PG_CONTAINER_NAME'..."
  docker start "$PG_CONTAINER_NAME" >/dev/null
else
  echo "Creating Postgres container '$PG_CONTAINER_NAME' on port $PG_PORT..."
  docker run -d \
    --name "$PG_CONTAINER_NAME" \
    -p "$PG_PORT:5432" \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=coach_me \
    postgres >/dev/null
fi

echo "Waiting for Postgres to accept connections..."
for i in $(seq 1 30); do
  if docker exec "$PG_CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" = 30 ]; then
    echo "Postgres didn't become ready in time." >&2
    exit 1
  fi
done

echo "Running Prisma migrations..."
npx prisma migrate dev --name init --skip-seed

echo "Starting Next.js dev server..."
exec npm run dev
