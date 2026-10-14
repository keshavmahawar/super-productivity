#!/bin/sh
set -eu
umask 077
# Kernel lock prevents multiple Electron instances sharing the persistent profile.
if [ "${CLIENT_LOCK_HELD:-}" != 1 ]; then
  exec flock --no-fork --nonblock /data/client.lock env CLIENT_LOCK_HELD=1 sh "$0"
fi
if [ ! -s /run/secrets/setup_vnc_password ]; then
  echo 'Provide a nonempty setup_vnc_password secret before starting.' >&2
  exit 1
fi
children=''
echo 'Starting client services (production Electron; sandbox enabled)' >&2
cleanup() { trap - EXIT INT TERM; kill $children 2>/dev/null || true; wait || true; }
trap cleanup EXIT INT TERM
Xvfb :99 -screen 0 1280x900x24 -nolisten tcp & children="$children $!"
echo "Xvfb PID $!" >&2
sleep 1
openbox & children="$children $!"
x11vnc -display :99 -localhost -rfbport 5900 -forever -shared -passwdfile /run/secrets/setup_vnc_password -quiet & children="$children $!"
websockify --web=/usr/share/novnc 6080 localhost:5900 & children="$children $!"
node /opt/client/proxy.cjs & children="$children $!"
echo "Started Xvfb/openbox/x11vnc/websockify/proxy PIDs:$children" >&2
smoke_arg=''
if [ "${CLIENT_DISPOSABLE_SMOKE:-}" = 1 ]; then
  smoke_arg='--remote-debugging-port=9222'
fi
dbus-run-session -- /app/node_modules/electron/dist/electron /app --user-data-dir=/data/profile --ozone-platform=x11 --disable-gpu --disable-tray $smoke_arg & app_pid=$!; children="$children $app_pid"
echo "Electron dbus-run-session PID $app_pid" >&2
while :; do
  for pid in $children; do
    if ! kill -0 "$pid" 2>/dev/null; then
      status=0
      wait "$pid" || status=$?
      echo "Required service PID $pid exited with status $status; stopping container." >&2
      exit 1
    fi
  done
  sleep 2
done
