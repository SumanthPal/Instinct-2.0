#!/usr/bin/env bash
# Throwaway local database with the repo's migrations and seed data.
# It never connects to the live Supabase project.
#
#   scripts/db-local.sh up      start it if needed (make db-local)
#   scripts/db-local.sh reset   wipe and rebuild from scratch (make db-reset)
#
# With the Supabase CLI installed this uses `supabase db start` / `supabase db
# reset`. Otherwise it runs one plain Postgres + pgvector container and loads
# scripts/db-local-stub.sql (roles, auth.uid() etc.) before the migrations.
# Seeds from supabase/seed.local.sql when present, else supabase/seed.sql, and
# only while public.clubs is empty, so a restarted database is never re-seeded
# and a half-built one is rebuilt (Docker) or re-seeded (CLI).
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
MODE=${1:-up}
URL="postgresql://postgres:postgres@localhost:$PORT/postgres"

psql_in() { # psql_in <container> [psql args...]
  local c=$1; shift
  $DOCKER exec -i -e PGPASSWORD=postgres "$c" psql -X -q -h 127.0.0.1 -U postgres -d postgres "$@"
}
run_sql() { # run_sql <container> <file>: all or nothing
  echo "  applying $2"
  psql_in "$1" -o /dev/null -v ON_ERROR_STOP=1 --single-transaction < "$2"
}
seeded() { # true once public.clubs exists and has rows
  [ "$(psql_in "$1" -tAc 'select exists (select 1 from public.clubs)' 2>/dev/null)" = t ]
}
wait_pg() { # the image's init server is socket-only; TCP answers once the real one is up
  for _ in $(seq 60); do
    $DOCKER exec "$1" pg_isready -q -h 127.0.0.1 -U postgres && return 0
    sleep 1
  done
  echo "Postgres in $1 did not come up; try make db-reset" >&2; return 1
}

if command -v supabase >/dev/null; then
  # A no-op when running. On a fresh volume it applies the migrations; seeding
  # is off in config.toml so both modes load the seed the same way, below.
  supabase db start
  if [ "$MODE" = reset ]; then supabase db reset; fi
  seeded supabase_db_instinct || run_sql supabase_db_instinct "$SEED"
  echo "DATABASE_URL=$URL"
  exit 0
fi

if [ "$MODE" = reset ]; then $DOCKER rm -f -v "$CONTAINER" >/dev/null 2>&1 || true; fi
if [ -n "$($DOCKER ps -aq -f name="^$CONTAINER\$")" ]; then
  $DOCKER start "$CONTAINER" >/dev/null
  wait_pg "$CONTAINER"
  if seeded "$CONTAINER"; then echo "DATABASE_URL=$URL"; exit 0; fi
  echo "  $CONTAINER was never fully initialised; rebuilding"
  $DOCKER rm -f -v "$CONTAINER" >/dev/null
fi
# Any failure from here on removes the container, so the next run starts clean.
trap '$DOCKER rm -f -v "$CONTAINER" >/dev/null 2>&1' EXIT
$DOCKER run -d --name "$CONTAINER" -p "127.0.0.1:$PORT:5432" \
  -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
wait_pg "$CONTAINER"
run_sql "$CONTAINER" scripts/db-local-stub.sql
for f in supabase/migrations/*.sql; do run_sql "$CONTAINER" "$f"; done
run_sql "$CONTAINER" "$SEED"
trap - EXIT
echo "DATABASE_URL=$URL"
