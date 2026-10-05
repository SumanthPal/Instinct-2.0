#!/usr/bin/env bash
# Throwaway local database with the repo's migrations and seed data.
# It never connects to the live Supabase project.
#
#   scripts/db-local.sh up      start it if needed (make db-local)
#   scripts/db-local.sh reset   wipe and rebuild from scratch (make db-reset)
#
# With the Supabase CLI installed this uses `supabase start` / `supabase db
# reset`. Otherwise it runs one plain Postgres + pgvector container and loads
# scripts/db-local-stub.sql (roles, auth.uid() etc.) before the migrations.
# Seeds from supabase/seed.local.sql when present, else supabase/seed.sql.
#
# Env: DOCKER="sudo docker" if your user can't reach the Docker socket;
# DB_IMAGE, DB_PORT, DB_CONTAINER to override the defaults below.
#
# Docker's vfs storage driver (the agents' box) keeps every image layer as a
# full copy; pulling pgvector/pgvector:pg15 there would take ~4 GB. Import a
# single-layer copy once instead (crane: github.com/google/go-containerregistry):
#   crane export pgvector/pgvector:pg15 - | sudo docker import \
#     -c 'ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/15/bin' \
#     -c 'ENV PGDATA=/var/lib/postgresql/data' -c 'ENV LANG=en_US.utf8' \
#     -c 'ENTRYPOINT ["docker-entrypoint.sh"]' -c 'CMD ["postgres"]' \
#     -c 'STOPSIGNAL SIGINT' - pgvector-flat:pg15
#   DOCKER="sudo docker" DB_IMAGE=pgvector-flat:pg15 make db-local
set -euo pipefail
cd "$(dirname "$0")/.."

DOCKER=${DOCKER:-docker}
IMAGE=${DB_IMAGE:-pgvector/pgvector:pg15}
PORT=${DB_PORT:-54322}
CONTAINER=${DB_CONTAINER:-instinct-db}
SEED=supabase/seed.sql
[ -f supabase/seed.local.sql ] && SEED=supabase/seed.local.sql

run_sql() { # run_sql <container> <file>
  echo "  applying $2"
  $DOCKER exec -i "$1" psql -q -o /dev/null -v ON_ERROR_STOP=1 -U postgres -d postgres < "$2"
}

if command -v supabase >/dev/null; then
  # supabase/config.toml disables CLI seeding so both modes load the same file.
  if supabase status >/dev/null 2>&1; then
    [ "${1:-up}" = reset ] || { supabase status; exit 0; }
    supabase db reset
  else
    supabase start
  fi
  run_sql supabase_db_instinct "$SEED"
  supabase status
  exit 0
fi

[ "${1:-up}" = reset ] && $DOCKER rm -f -v "$CONTAINER" >/dev/null 2>&1 || true
fresh=
if [ -z "$($DOCKER ps -aq -f name="^$CONTAINER\$")" ]; then
  $DOCKER run -d --name "$CONTAINER" -p "127.0.0.1:$PORT:5432" \
    -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
  fresh=1
else
  $DOCKER start "$CONTAINER" >/dev/null
fi
# The image's init server is socket-only; TCP answers once the real one is up.
until $DOCKER exec "$CONTAINER" pg_isready -q -h 127.0.0.1 -U postgres; do sleep 1; done
if [ -n "$fresh" ]; then
  run_sql "$CONTAINER" scripts/db-local-stub.sql
  for f in supabase/migrations/*.sql; do run_sql "$CONTAINER" "$f"; done
  run_sql "$CONTAINER" "$SEED"
fi
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:$PORT/postgres"
