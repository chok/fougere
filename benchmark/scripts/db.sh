#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export PGHOST=127.0.0.1 PGPORT=55432
case "${1:-start}" in
  start)
    if [ ! -f .runtime/postgres/PG_VERSION ]; then
      initdb -D .runtime/postgres --auth=trust --encoding=UTF8 --no-locale
    fi
    if ! pg_ctl -D .runtime/postgres status >/dev/null 2>&1; then
      pg_ctl -D .runtime/postgres -l raw-results/postgres.log -o '-h 127.0.0.1 -p 55432 -k /tmp -c max_connections=80' start
    fi
    if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='framework_benchmark'" | rg -q 1; then
      createdb framework_benchmark
    fi
    ;;
  stop) pg_ctl -D .runtime/postgres stop -m fast ;;
  *) exit 2 ;;
esac
