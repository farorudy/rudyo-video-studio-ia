#!/usr/bin/env bash
# Réseau Docker isolé + PostgreSQL pour la validation Linux du worker.
set -u

docker network create rudyo-net >/dev/null 2>&1 || true
docker rm -f rudyo-pg >/dev/null 2>&1 || true

docker run -d --name rudyo-pg --network rudyo-net \
  -e POSTGRES_PASSWORD=rudyo -e POSTGRES_USER=rudyo -e POSTGRES_DB=rudyo \
  -p 55433:5432 postgres:17-alpine >/dev/null

for _ in $(seq 1 40); do
  if docker exec rudyo-pg pg_isready -U rudyo -d rudyo >/dev/null 2>&1; then
    echo "postgres=ready"
    docker exec rudyo-pg psql -U rudyo -d rudyo -tAc 'select version()' | head -c 60
    echo
    exit 0
  fi
  sleep 2
done

echo "POSTGRES_UNAVAILABLE"
docker logs --tail 20 rudyo-pg
exit 1
