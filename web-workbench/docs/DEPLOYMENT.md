# Deploying Singular Online

Singular Online is a static site. The webserver serves files, Singular runs in
the users' browser sandbox as WebAssembly.

The recommended public deployment uses two locations:

- your webserver for the app and large engine files
- GitHub, via release assets or a manifest branch, for a signed release manifest
  that lists the expected hashes for every browser-served file.

This catches broken uploads, stale webserver files, and accidental deployment
mismatches automatically in the browser before Singular starts.

## One-time setup

### 1. Choose a release URL pattern

Use immutable paths on your webserver:

```text
https://www.singular.uni-kl.de/wasm/releases/2026-06-04/
```

Keep a separate convenience redirect, if wanted:

```text
https://www.singular.uni-kl.de/wasm/latest/ -> /wasm/releases/2026-06-04/
```

Do not replace files in an existing release directory. Publish a new directory
for each release.

### 2. Create a release signing key

Create the key once, on a maintainer machine:

```bash
mkdir -p ~/.singular-wasm-release
openssl genpkey \
  -algorithm EC \
  -pkeyopt ec_paramgen_curve:P-256 \
  -out ~/.singular-wasm-release/singular-wasm-release-private.pem
openssl pkey \
  -in ~/.singular-wasm-release/singular-wasm-release-private.pem \
  -pubout \
  -out ~/.singular-wasm-release/singular-wasm-release-public.pem
```

Keep `singular-wasm-release-private.pem` private. Store it as a GitHub Actions
secret only if CI will sign releases. The browser receives only
`singular-wasm-release-public.pem`.

### 3. Choose where public manifests live

The current workflow attaches the release zip, `release-manifest.json`, and
`release-manifest.json.sig` to the GitHub Release. That is the simplest way to
archive build outputs without committing large files.

For browser-side automatic verification, the app needs stable URLs for the
manifest and signature. GitHub Release asset URLs work, but they are less
pleasant to hard-code than raw files on a protected branch. A dedicated branch
such as `gh-pages` or `wasm-manifests` is still a good option for the small
manifest files:

```text
singular-wasm/2026-06-04/release-manifest.json
singular-wasm/2026-06-04/release-manifest.json.sig
```

The browser should fetch those files through `raw.githubusercontent.com`, for
example:

```text
https://raw.githubusercontent.com/Singular/Singular-in-browser/gh-pages/singular-wasm/2026-06-04/release-manifest.json
https://raw.githubusercontent.com/Singular/Singular-in-browser/gh-pages/singular-wasm/2026-06-04/release-manifest.json.sig
```

Protect that branch or restrict who can push to it.

If the branch does not exist yet, create it once:

```bash
git clone git@github.com:Singular/Singular-in-browser.git /tmp/singular-manifest-branch
cd /tmp/singular-manifest-branch
git switch --orphan gh-pages
git rm -rf .
mkdir -p singular-wasm
printf '# Singular WASM release manifests\n' > README.md
git add README.md singular-wasm
git commit -m "initialize Singular WASM manifest branch"
git push origin gh-pages
cd -
```

## Per-release build and package

From a checkout with the workbench and generated engine/vendor files:

```bash
export RELEASE_ID=2026-06-04
export SERVER_BASE_URL="https://www.singular.uni-kl.de/wasm/releases/${RELEASE_ID}/"
export GITHUB_MANIFEST_URL="https://raw.githubusercontent.com/Singular/Singular-in-browser/gh-pages/singular-wasm/${RELEASE_ID}/release-manifest.json"
export SIGNING_KEY="$HOME/.singular-wasm-release/singular-wasm-release-private.pem"
export TRUST_RELEASE_MANIFEST_URL="${GITHUB_MANIFEST_URL}"
export TRUST_RELEASE_SIGNATURE_URL="https://raw.githubusercontent.com/Singular/Singular-in-browser/gh-pages/singular-wasm/${RELEASE_ID}/release-manifest.json.sig"
export TRUST_PUBLIC_KEY_FILE="$HOME/.singular-wasm-release/singular-wasm-release-public.pem"

bash web-workbench/scripts/package-served-files.sh
```

This writes:

```text
web-workbench/dist/2026-06-04/singular-workbench-2026-06-04.zip
web-workbench/dist/2026-06-04/deploy-2026-06-04.zip
web-workbench/dist/2026-06-04/release-manifest.json
web-workbench/dist/2026-06-04/release-manifest.json.sig
web-workbench/dist/2026-06-04/release-manifest.json.sig.base64
```

The `deploy-<release>.zip` file is the direct upload package for static
hosting providers that accept a single zip. It contains `_headers` at the root
for hosts that consume that file. `_headers` is deploy configuration and is not
listed in the signed release manifest.

## Configure the browser trust anchor

The packaging command above injects the browser trust anchor into the packaged
copy of:

```text
trust-config.js
```

The generated file in the zip will contain:

```js
window.SINGULAR_WORKBENCH_TRUST = {
  releaseManifestUrl: 'https://raw.githubusercontent.com/Singular/Singular-in-browser/gh-pages/singular-wasm/2026-06-04/release-manifest.json',
  releaseSignatureUrl: 'https://raw.githubusercontent.com/Singular/Singular-in-browser/gh-pages/singular-wasm/2026-06-04/release-manifest.json.sig',
  publicKeyPem: `-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----`
}
```

Do not edit the tracked `public/trust-config.js` for each deployment. It stays
disabled in source. The packaging script writes a release-specific copy in
`dist/<release-id>/public/trust-config.js`, hashes that copy, and puts that copy
inside the zip. The manifest must describe the exact bytes that will be served
by the webserver.

## Publish small manifests to GitHub

Copy the manifest and signature to the manifest branch:

```bash
export RELEASE_ID=2026-06-04
git fetch origin gh-pages
git worktree add /tmp/singular-wasm-manifests origin/gh-pages
mkdir -p "/tmp/singular-wasm-manifests/singular-wasm/${RELEASE_ID}"
cp "web-workbench/dist/${RELEASE_ID}/release-manifest.json" \
  "/tmp/singular-wasm-manifests/singular-wasm/${RELEASE_ID}/release-manifest.json"
cp "web-workbench/dist/${RELEASE_ID}/release-manifest.json.sig" \
  "/tmp/singular-wasm-manifests/singular-wasm/${RELEASE_ID}/release-manifest.json.sig"
cd /tmp/singular-wasm-manifests
git add "singular-wasm/${RELEASE_ID}"
git commit -m "publish Singular WASM manifest ${RELEASE_ID}"
git push origin HEAD:gh-pages
cd -
git worktree remove /tmp/singular-wasm-manifests
```

Do not push from Codex unless explicitly requested.

## Publish to the webserver

Unzip the runtime bundle into the release directory:

```bash
export RELEASE_ID=2026-06-04
ssh singular-webserver "mkdir -p /var/www/singular/wasm/releases/${RELEASE_ID}"
scp "web-workbench/dist/${RELEASE_ID}/singular-workbench-${RELEASE_ID}.zip" singular-webserver:/tmp/
ssh singular-webserver "
  cd /var/www/singular/wasm/releases/${RELEASE_ID}
  unzip -o /tmp/singular-workbench-${RELEASE_ID}.zip
"
```

Make sure the vhost uses the headers from:

```text
web-workbench/deploy/nginx.conf
```

Important details:

- serve over HTTPS
- serve `.wasm` as `application/wasm`
- keep `/engine/*` and `/vendor/*` as `Cache-Control: no-store`
- allow `connect-src 'self' https://raw.githubusercontent.com` in the CSP.

## Verify after upload

From a maintainer machine:

```bash
export RELEASE_ID=2026-06-04
node web-workbench/scripts/verify-deployed-release.mjs \
  --server-base-url "https://www.singular.uni-kl.de/wasm/releases/${RELEASE_ID}/" \
  --manifest-url "https://raw.githubusercontent.com/Singular/Singular-in-browser/gh-pages/singular-wasm/${RELEASE_ID}/release-manifest.json" \
  --signature-url "https://raw.githubusercontent.com/Singular/Singular-in-browser/gh-pages/singular-wasm/${RELEASE_ID}/release-manifest.json.sig" \
  --public-key "$HOME/.singular-wasm-release/singular-wasm-release-public.pem"
```

The browser performs the same kind of check before starting Singular. If any
deployed file differs from the GitHub manifest, startup fails.

## GitHub Actions notes

If you automate publishing with GitHub Actions:

- store the private key as a repository or organization secret
- use `permissions: contents: write` only for the release/publish job
- keep untrusted pull-request builds on read-only permissions
- avoid `pull_request_target` for building contributor code.

GitHub Actions workflows must live in `.github/workflows/`, and the
`permissions` key controls the `GITHUB_TOKEN` access. `contents: write` is the
permission that allows a workflow to create releases or update repository
contents.
