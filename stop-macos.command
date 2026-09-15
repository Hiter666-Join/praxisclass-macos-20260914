#!/bin/bash
set -e
BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"
exec /bin/bash "$BUNDLE_DIR/start-macos.command" --stop
