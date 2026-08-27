#!/usr/bin/env bash
# Démarre le démon Docker dans WSL (sans systemd garanti) et attend qu'il réponde.
set -u

if command -v systemctl >/dev/null 2>&1 && systemctl start docker >/dev/null 2>&1; then
  echo "daemon=systemd"
else
  if ! pgrep -x dockerd >/dev/null 2>&1; then
    nohup dockerd >/var/log/dockerd.log 2>&1 &
  fi
  echo "daemon=nohup"
fi

for _ in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    docker info --format 'Server={{.ServerVersion}} OS={{.OperatingSystem}} Arch={{.Architecture}} Driver={{.Driver}}'
    exit 0
  fi
  sleep 2
done

echo "DOCKER_DAEMON_UNAVAILABLE"
tail -n 25 /var/log/dockerd.log 2>/dev/null || true
exit 1
