#!/usr/bin/env bash
# Copie le contexte worker dans le FS natif WSL puis construit l'image Linux.
set -euo pipefail

SRC="/mnt/c/Users/CIP FARO/rudyo-video-studio/source/worker"
DST="/root/rudyo-worker-build"

rm -rf "$DST"
mkdir -p "$DST"
for item in package.json package-lock.json tsconfig.json Dockerfile .dockerignore src tests; do
  cp -r "$SRC/$item" "$DST/" 2>/dev/null || echo "skip: $item"
done

cd "$DST"
docker build -t rudyo-worker:test . 2>&1 | tail -n 25
echo "---"
docker image inspect rudyo-worker:test --format 'image={{.Id}} size={{.Size}} user={{.Config.User}} entrypoint={{.Config.Entrypoint}} cmd={{.Config.Cmd}}'
