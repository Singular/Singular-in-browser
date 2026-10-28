# CI security notes for the WebAssembly workbench

The active workflow in `.github/workflows/build.yml` builds the WebAssembly
target on pull requests, on a daily schedule, and on manual requests. Building
executes checked-out Singular and browser code plus third-party
bootstrap/configure scripts. That is normal for this build, but pull-request
output must be treated as untrusted.

Pull-request and scheduled jobs have read-only repository permissions, do not
receive signing keys, and can only upload workflow artifacts. Scheduled runs
always use the unsigned path. The manual `create_release` path is accepted only
when the workflow itself runs from the default `main` branch, the maintainer
confirms that branch is trusted, the Singular ref is the trusted `spielwiese`
branch, and the release tag matches the restricted date-based format. Signed
tests have the same branch and Singular-ref restrictions and require a `test-*`
release id.

The build job never receives the signing secrets. For signed runs it uploads
only the built public files. A fresh signing job checks out the exact trusted
browser commit, uses its packaging scripts, treats the build output as data,
records the resolved Singular commit, signs and verifies the manifest, removes
the private-key file, and only then uploads the release artifacts. Third-party
Actions used by this workflow are pinned to full commit SHAs.

Recommended policy:

- Use ordinary `pull_request` checks for external contributors, not
  `pull_request_target`, when building or testing PR code.
- Set `permissions: { contents: read }` or the narrowest equivalent.
- Do not expose repository, deployment, package, or cloud secrets to the build.
- Keep signing in a fresh job which executes only trusted packaging code; never
  sign in the job that built or tested project and dependency code.
- Do not run this build on persistent self-hosted runners unless the runner is
  disposable and isolated.
- Disable credential persistence in `actions/checkout` when the job does not
  need to push: `persist-credentials: false`.
- Avoid restoring or saving privileged caches from untrusted PR builds.
- Review any workflow changes before approving forked PR runs.
- Treat produced artifacts as untrusted until maintainers have reviewed the
  source, dependency pins, and build logs.
- Before publishing artifacts, pin every third-party source used by
  `emscripten/build.sh` to an immutable commit or release archive and verify
  checksums for downloaded tarballs.
- Publish the generated browser vendor and engine manifests with the artifact so
  users can verify what the browser loads.
- For public deployments, publish a signed release manifest on a protected
  GitHub branch or release path and configure the browser trust anchor described
  in `docs/DEPLOYMENT.md`.
- Never replace a manifest already published under a release id. The workflow
  treats `gh-pages/singular-wasm/<release-id>/` as immutable.
- Keep the actual release in draft state until all assets are uploaded and the
  signed manifest is safely published. A failed release run should leave a
  recoverable draft rather than a public partial release.
- Verify every generated signature with the configured public key before
  uploading it. This catches mismatched or incompletely rotated key secrets.
- Delete the private-key file before running artifact upload or publication
  steps.
- Serialize writes to the manifest branch and rebase immediately before push so
  concurrent releases cannot silently lose one another's manifest commits.

The example in `ci/build-workbench.yml.example` remains useful for independent
deployments, but the repository workflow is the authoritative CI and release
path.
