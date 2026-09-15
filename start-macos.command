#!/bin/bash
set -e
BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BUNDLE_DIR"
case "$(uname -m)" in
  arm64) NODE_ARCH="arm64" ;;
  x86_64) NODE_ARCH="x64" ;;
  *) echo "This package supports Apple Silicon and Intel Macs."; exit 1 ;;
esac
NODE_DIR="$BUNDLE_DIR/.tools/runtime/node-v24.14.0-darwin-$NODE_ARCH"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  tar -xzf "$BUNDLE_DIR/.tools/runtime/node-v24.14.0-darwin-$NODE_ARCH.tar.gz" -C "$BUNDLE_DIR/.tools/runtime"
fi
chmod +x "$BUNDLE_DIR/.tools/bin/pnpm"
exec "$NODE_DIR/bin/node" "$BUNDLE_DIR/start-demo.mjs" "$@"
