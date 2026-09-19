#!/bin/sh
set -eu

Xvfb :99 -screen 0 1280x720x24 -ac >/tmp/xvfb.log 2>&1 &
xvfb_pid=$!

cleanup() {
  kill "$xvfb_pid" 2>/dev/null || true
}

trap cleanup TERM INT EXIT
export DISPLAY=:99

sleep 1
exec yarn relay:ntv
