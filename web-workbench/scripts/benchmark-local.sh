#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"

cd "${ROOT_DIR}"

missing=0
for f in public/engine/Singular.js public/vendor/xterm/xterm.js public/vendor/xterm/xterm.css public/vendor/xterm-pty/index.mjs public/vendor/xterm-pty/workerTools.js public/vendor/katex/katex.min.css public/vendor/katex/katex.min.js; do
  if [[ ! -f "$f" ]]; then
    echo "Missing: $f" >&2
    missing=1
  fi
done
if [[ "${missing}" -ne 0 ]]; then
  cat >&2 <<MSG
Required runtime files are missing.

Build/copy the Singular engine:
  bash scripts/build-full-wasm.sh

Fetch browser dependencies:
  bash scripts/fetch-web-deps.sh
MSG
  exit 1
fi

python3 scripts/serve-local.py --port "${PORT}" > .benchmark-http.log 2>&1 &
server_pid=$!
trap 'kill ${server_pid} 2>/dev/null || true' EXIT
sleep 1

if [[ -x node_modules/.bin/playwright ]]; then
  node scripts/benchmark-browser.mjs "http://127.0.0.1:${PORT}/"
else
  cat <<MSG
Serving at http://127.0.0.1:${PORT}/
Open the page and click "Benchmark startup/run".

For an automated browser benchmark:
  npm install
  npx playwright install chromium
  bash scripts/benchmark-local.sh
MSG
fi
