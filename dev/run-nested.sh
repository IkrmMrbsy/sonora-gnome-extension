#!/usr/bin/env bash
# Run the extension inside a nested GNOME Shell session with a fake MPRIS
# player, so development never touches the real desktop session.
#
# Usage: ./dev/run-nested.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f schemas/gschemas.compiled ]; then
  glib-compile-schemas schemas
fi

exec dbus-run-session -- bash -c './dev/fake-spotify.js & gnome-shell --nested --wayland'
