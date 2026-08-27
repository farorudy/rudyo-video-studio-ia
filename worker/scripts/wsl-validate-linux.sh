#!/usr/bin/env bash
# Validation complète du worker dans un conteneur Linux compatible Railway.
# Tout se déroule dans une seule session WSL pour que le démon et les
# conteneurs survivent d'un test à l'autre.
set -u

SRC="/mnt/c/Users/CIP FARO/rudyo-video-studio/source/worker"
IMAGE="rudyo-worker:test"
SECRET="linux-validation-shared-secret-32chars-min"
DB="postgresql://rudyo:rudyo@rudyo-pg:5432/rudyo"
PASS=0
FAIL=0

ok()   { echo "PASS | $*"; PASS=$((PASS+1)); }
ko()   { echo "FAIL | $*"; FAIL=$((FAIL+1)); }
step() { echo; echo "== $* =="; }

wnode() { docker exec rudyo-worker node -e "$1" 2>&1; }

# ---------------------------------------------------------------- daemon
step "Démon Docker"
if command -v systemctl >/dev/null 2>&1; then systemctl start docker >/dev/null 2>&1; fi
if ! docker info >/dev/null 2>&1; then
  pgrep -x dockerd >/dev/null 2>&1 || nohup dockerd >/var/log/dockerd.log 2>&1 &
fi
for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done
docker info >/dev/null 2>&1 && ok "dockerd répond ($(docker info --format '{{.ServerVersion}}'))" || { ko "dockerd indisponible"; exit 1; }

# ---------------------------------------------------------------- postgres
step "PostgreSQL conteneurisé"
docker network create rudyo-net >/dev/null 2>&1 || true
docker rm -f rudyo-pg rudyo-worker >/dev/null 2>&1 || true
docker run -d --name rudyo-pg --network rudyo-net \
  -e POSTGRES_PASSWORD=rudyo -e POSTGRES_USER=rudyo -e POSTGRES_DB=rudyo \
  postgres:17-alpine >/dev/null
for _ in $(seq 1 40); do docker exec rudyo-pg pg_isready -U rudyo -d rudyo >/dev/null 2>&1 && break; sleep 2; done
docker exec rudyo-pg pg_isready -U rudyo -d rudyo >/dev/null 2>&1 && ok "PostgreSQL prêt" || { ko "PostgreSQL indisponible"; exit 1; }

docker cp "$SRC/scripts/schema.sql" rudyo-pg:/tmp/schema.sql >/dev/null
if docker exec rudyo-pg psql -U rudyo -d rudyo -q -v ON_ERROR_STOP=1 -f /tmp/schema.sql >/tmp/schema.log 2>&1; then
  ok "schéma Prisma appliqué ($(docker exec rudyo-pg psql -U rudyo -d rudyo -tAc "select count(*) from information_schema.tables where table_schema='public'") tables)"
else
  ko "schéma refusé"; tail -n 5 /tmp/schema.log
fi

# ---------------------------------------------------------------- fixtures
step "Fixtures de stockage mock"
docker volume rm -f rudyo-storage >/dev/null 2>&1 || true
docker volume create rudyo-storage >/dev/null
docker run --rm -u 0 -v rudyo-storage:/storage "$IMAGE" bash -c '
  mkdir -p /storage/linux-fixtures
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i color=c=navy:s=1080x1080 -frames:v 1 /storage/linux-fixtures/portrait.png
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i sine=frequency=440:sample_rate=44100:duration=15 -c:a pcm_s16le /storage/linux-fixtures/music.wav
  chown -R node:node /storage
' >/dev/null 2>&1
docker run --rm -v rudyo-storage:/storage "$IMAGE" test -f /storage/linux-fixtures/music.wav \
  && ok "photo et musique synthétiques créées" || ko "fixtures manquantes"

# ---------------------------------------------------------------- worker
step "Démarrage du worker"
docker run -d --name rudyo-worker --network rudyo-net -p 8080:8080 \
  -v rudyo-storage:/storage \
  -e NODE_ENV=production \
  -e DATABASE_URL="$DB" \
  -e WORKER_MOCK_MODE=true \
  -e STORAGE_MOCK_MODE=true \
  -e LOCAL_STORAGE_ROOT=/storage \
  -e WORKER_SHARED_SECRET="$SECRET" \
  -e MONTAGE_TEMP_DIR=/var/lib/rudyo-montage \
  -e MONTAGE_POLL_INTERVAL_MS=1000 \
  -e MONTAGE_HEARTBEAT_SECONDS=5 \
  -e MONTAGE_SIGNAL_SECONDS=5 \
  -e PORT=8080 \
  "$IMAGE" >/dev/null
sleep 6
[ "$(docker inspect -f '{{.State.Running}}' rudyo-worker)" = "true" ] \
  && ok "conteneur worker en cours d'exécution" || { ko "worker arrêté"; docker logs --tail 30 rudyo-worker; exit 1; }
ok "utilisateur du conteneur : $(docker exec rudyo-worker id -un) (non-root : $(docker exec rudyo-worker id -u))"
ok "binaires Linux : $(docker exec rudyo-worker ffmpeg -version 2>/dev/null | head -1 | cut -c1-24) / $(docker exec rudyo-worker ffprobe -version 2>/dev/null | head -1 | cut -c1-25)"

# ---------------------------------------------------------------- /health
step "GET /health"
HEALTH=$(wnode "fetch('http://127.0.0.1:8080/health').then(async r=>{console.log(r.status+' '+(await r.text()).slice(0,200))}).catch(e=>console.log('ERR '+e.message))")
echo "  -> $HEALTH"
case "$HEALTH" in 200*) ok "/health répond 200" ;; *) ko "/health inattendu" ;; esac

# ---------------------------------------------------------------- database
step "Connexion PostgreSQL depuis le worker"
sleep 4
HB=$(docker exec rudyo-pg psql -U rudyo -d rudyo -tAc "select status || ' db=' || \"databaseAvailable\" || ' ffmpeg=' || \"ffmpegAvailable\" || ' storage=' || \"storageAvailable\" from \"WorkerHeartbeat\" order by \"lastSeenAt\" desc limit 1" 2>/dev/null)
echo "  -> heartbeat: ${HB:-aucun}"
case "$HB" in ONLINE*db=t*ffmpeg=t*storage=t*) ok "heartbeat ONLINE, base/FFmpeg/stockage disponibles" ;; *) ko "heartbeat incomplet" ;; esac

# ---------------------------------------------------------------- job mock
step "Création du MP4 mock"
docker cp "$SRC/scripts/linux-seed.mjs" rudyo-worker:/app/seed.mjs >/dev/null
SEED=$(docker exec -e DATABASE_URL="$DB" rudyo-worker node /app/seed.mjs 2>&1 | tail -3)
echo "  -> $SEED"
JOB_ID=$(echo "$SEED" | sed -n 's/.*"jobId":"\([^"]*\)".*/\1/p')
OUT_KEY=$(echo "$SEED" | sed -n 's/.*"outputStorageKey":"\([^"]*\)".*/\1/p')
if [ -z "$JOB_ID" ]; then ko "amorçage impossible"; docker logs --tail 20 rudyo-worker; exit 1; fi

STATUS=""
for _ in $(seq 1 60); do
  STATUS=$(docker exec rudyo-pg psql -U rudyo -d rudyo -tAc "select status from \"ClipWorkerJob\" where id='$JOB_ID'" 2>/dev/null | tr -d ' ')
  case "$STATUS" in SUCCEEDED|FAILED|REFUNDED) break ;; esac
  sleep 2
done
echo "  -> statut final: $STATUS"
[ "$STATUS" = "SUCCEEDED" ] && ok "tâche terminée avec succès" || { ko "tâche en échec ($STATUS)"; docker logs --tail 25 rudyo-worker; }

# ---------------------------------------------------------------- MP4
step "Contrôle du MP4 produit"
PROBE=$(docker exec rudyo-worker ffprobe -v error -show_entries stream=codec_name,codec_type,width,height -of default=nw=1 "/storage/$OUT_KEY" 2>&1)
echo "$PROBE" | sed 's/^/  /'
echo "$PROBE" | grep -q 'codec_name=h264' && ok "piste vidéo H.264" || ko "H.264 absent"
echo "$PROBE" | grep -q 'codec_name=aac'  && ok "piste audio AAC"  || ko "AAC absent"
if echo "$PROBE" | grep -q 'width=720' && echo "$PROBE" | grep -q 'height=1280'; then
  ok "format vertical 720 x 1280"
else
  ko "dimensions inattendues"
fi
SIZE=$(docker exec rudyo-worker stat -c %s "/storage/$OUT_KEY" 2>/dev/null)
ok "MP4 téléchargeable : ${SIZE:-0} octets"

# ---------------------------------------------------------------- temp
step "Nettoyage du répertoire temporaire"
LEFT=$(docker exec rudyo-worker bash -c 'ls -1 /var/lib/rudyo-montage 2>/dev/null | grep -c "^job-" || true')
PERM=$(docker exec rudyo-worker stat -c %a /var/lib/rudyo-montage 2>/dev/null)
echo "  -> répertoires job-* restants: ${LEFT:-?}, permissions: ${PERM:-?}"
[ "${LEFT:-1}" = "0" ] && ok "aucun fichier temporaire résiduel" || ko "$LEFT répertoire(s) temporaire(s) orphelin(s)"

# ---------------------------------------------------------------- SIGTERM
step "Arrêt par SIGTERM"
docker kill --signal=SIGTERM rudyo-worker >/dev/null
for _ in $(seq 1 20); do
  [ "$(docker inspect -f '{{.State.Running}}' rudyo-worker)" = "false" ] && break
  sleep 1
done
RUNNING=$(docker inspect -f '{{.State.Running}}' rudyo-worker)
CODE=$(docker inspect -f '{{.State.ExitCode}}' rudyo-worker)
echo "  -> running=$RUNNING exitCode=$CODE"
if [ "$RUNNING" = "false" ] && [ "$CODE" = "0" ]; then ok "arrêt gracieux, code de sortie 0"; else ko "arrêt non gracieux (code $CODE)"; fi
STOPHB=$(docker exec rudyo-pg psql -U rudyo -d rudyo -tAc "select status from \"WorkerHeartbeat\" order by \"lastSeenAt\" desc limit 1" 2>/dev/null | tr -d ' ')
[ "$STOPHB" = "STOPPING" ] && ok "heartbeat passé à STOPPING avant sortie" || ko "heartbeat final = $STOPHB"

# ---------------------------------------------------------------- orphans
step "Absence de tâche orpheline"
ORPHAN=$(docker exec rudyo-pg psql -U rudyo -d rudyo -tAc "select count(*) from \"ClipWorkerJob\" where status not in ('SUCCEEDED','FAILED','REFUNDED','QUEUED')" 2>/dev/null | tr -d ' ')
LOCKED=$(docker exec rudyo-pg psql -U rudyo -d rudyo -tAc "select count(*) from \"ClipWorkerJob\" where \"lockedBy\" is not null and status not in ('SUCCEEDED','FAILED','REFUNDED')" 2>/dev/null | tr -d ' ')
echo "  -> non terminales: $ORPHAN, verrouillées: $LOCKED"
[ "$ORPHAN" = "0" ] && [ "$LOCKED" = "0" ] && ok "aucune tâche orpheline après arrêt" || ko "tâches orphelines détectées"

# ---------------------------------------------------------------- restart
step "Reprise après redémarrage"
docker start rudyo-worker >/dev/null
sleep 8
H2=$(wnode "fetch('http://127.0.0.1:8080/health').then(async r=>console.log(r.status)).catch(e=>console.log('ERR'))")
case "$H2" in 200*) ok "/health de nouveau disponible après redémarrage" ;; *) ko "/health muet après redémarrage ($H2)" ;; esac

SEED2=$(docker exec -e DATABASE_URL="$DB" rudyo-worker node /app/seed.mjs 2>&1 | tail -3)
JOB2=$(echo "$SEED2" | sed -n 's/.*"jobId":"\([^"]*\)".*/\1/p')
OUT2=$(echo "$SEED2" | sed -n 's/.*"outputStorageKey":"\([^"]*\)".*/\1/p')
S2=""
for _ in $(seq 1 60); do
  S2=$(docker exec rudyo-pg psql -U rudyo -d rudyo -tAc "select status from \"ClipWorkerJob\" where id='$JOB2'" 2>/dev/null | tr -d ' ')
  case "$S2" in SUCCEEDED|FAILED|REFUNDED) break ;; esac
  sleep 2
done
echo "  -> seconde tâche: $S2"
[ "$S2" = "SUCCEEDED" ] && ok "nouvelle tâche traitée après redémarrage" || ko "reprise défaillante ($S2)"
docker exec rudyo-worker test -f "/storage/$OUT2" && ok "second MP4 présent" || ko "second MP4 absent"

# ---------------------------------------------------------------- résumé
step "Résumé"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] && echo "LINUX_VALIDATION=SUCCESS" || echo "LINUX_VALIDATION=FAILED"
