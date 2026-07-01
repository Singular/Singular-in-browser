# Singular in Browser

This repository contains the browser/WebAssembly build support and web
interface for running Singular in a user's browser sandbox. Try here:

https://singular-in-browser.pages.dev

The code builds on PR #1360 (and preserves the respective commits).

## Repo

Tracked:

- Emscripten build scripts
- browser frontend sources in `web-workbench/public`
- worker sources, deployment examples, and documentation
- placeholders such as `web-workbench/public/engine/README.md`.

Not tracked:

- `Singular.js`
- `Singular.wasm`
- `Singular.data`
- generated engine manifests
- release zip and `dist/`
- local Singular checkouts and dependency build trees.

The CI stores build output as workflow artifacts
(generated on pull requests or manual builds). Published releases attach the zip,
manifest, and signature as GitHub Release assets.

## Building In CI

Implemented in `.github/workflows/build.yml`:

1. checks out this repository
2. checks out `Singular/Singular` at the selected ref, default is
   `spielwiese`
3. overlays this repo into `Singular/emscripten`
4. builds the WebAssembly engine
5. packages the static web app
6. uploads a full release bundle and a deploy artifact.

For GitHub Releases, the workflow signs the release manifest and attaches the
deploy zips plus manifest files to the GitHub Release. The repository secrets
have to be configured before publishing signed releases:

```text
SINGULAR_WASM_RELEASE_PRIVATE_KEY_PEM
SINGULAR_WASM_RELEASE_PUBLIC_KEY_PEM
```

Pull-request builds do not need signing secrets and should remain read-only.

## Local Serving for Tests

After `web-workbench/public/engine/` and `web-workbench/public/vendor/` are
populated:

```bash
bash run-web-workbench.sh
```

open

```text
http://127.0.0.1:9999/
```

The local server sends the COOP/COEP headers required for `SharedArrayBuffer`.

## Deployment

The Singular webserver should serve immutable release directories, for example:

```text
https://www.singular.uni-kl.de/wasm/releases/2026-06-04/
```

Manual deployment from the deploy artifact is:

1. download `deploy-<release>.zip`, or the `deploy-<release>` workflow artifact
2. upload or unpack the zip on the static hosting provider.

Manual deployment to a normal static webserver is:

1. download `singular-workbench-<release>.zip`
2. unpack it into a new immutable release directory on the Singular webserver
3. make sure the webserver sends the headers from
   `web-workbench/deploy/nginx.conf`
4. keep old release directories immutable
5. optionally update a `latest` redirect after verification.

Detailed signing and deployment instructions are in
`web-workbench/docs/DEPLOYMENT.md`.
