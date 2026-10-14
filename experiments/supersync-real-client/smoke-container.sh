#!/bin/bash
set -euo pipefail
name="sp-real-client-smoke-${RANDOM}"
tmp=$(mktemp -d)
cleanup() { docker logs "$name" 2>/dev/null || true; docker rm -f -v "$name" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
# Disposable VNC fixture, no user account or real secrets.
printf '%s\n' 'ci-test1' > "$tmp/password"
chmod 644 "$tmp/password"
docker run -d --name "$name" --init --shm-size=1g -e CLIENT_DISPOSABLE_SMOKE=1 --mount "type=bind,src=$tmp/password,dst=/run/secrets/setup_vnc_password,readonly" superproductivity-real-client:local >/dev/null
docker exec "$name" node /opt/client/smoke-gui.cjs
docker exec "$name" node -e 'fetch("http://127.0.0.1:6080/vnc.html").then(r=>{if(!r.ok)process.exit(1)})'
