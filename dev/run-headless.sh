#!/usr/bin/env bash
# Run the extension inside a headless GNOME Shell with a fake MPRIS player.
# The private D-Bus session keeps development away from the real desktop.
#
# Usage: ./dev/run-headless.sh
# Stop with Ctrl-C.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f schemas/gschemas.compiled ]; then
  glib-compile-schemas schemas
fi

exec dbus-run-session -- bash -c '
  set -e
  ./dev/fake-spotify.js &
  fake=$!
  trap "kill $fake 2>/dev/null || true" EXIT
  gnome-shell --headless --virtual-monitor 1280x800
'
