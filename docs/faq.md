# FAQ

## Does mcp-lint call my tools?

No. It only sends `initialize` and the four list requests. It never calls `tools/call`, reads a
resource, or gets a prompt, so it is safe to run against a server with destructive tools.

## Why did my server get an F when it only has warnings?

Warnings cost 8 points each per tool. A tool with five warnings scores 60, and if most tools look
like that, the average falls below 60. Run with `--format markdown` to see which tools pull the
score down, or turn off rules that do not apply to you in `.mcp-lint.json`.

## Why is the score capped at 50?

Any error from an `injection/*` rule caps the score at 50. A single tool that tells the model to
hide something from the user compromises every conversation that loads the server, no matter how
clean the other tools are. See
[ADR 0002](adr/0002-average-entity-scores-and-cap-on-injection.md).

## How do I silence a false positive?

Set the rule to `off` or lower its severity in `.mcp-lint.json`, or add the tool to `ignoreTools`.
Inline suppressions for a single finding are on the roadmap.

## Which transports are supported?

stdio, Streamable HTTP, and the older HTTP+SSE transport. With `--url`, `mcp-lint` tries
Streamable HTTP first and falls back to SSE. Pass headers with `-H` for servers that need a token.

## Can I lint a server without running it?

Yes. Save its `tools/list` result, or run `mcp-lint --save snapshot.json -- <command>` once, then
lint the file with `--file`. This is the fastest way to gate pull requests in CI.

## What do the exit codes mean?

`0` means the score met the minimum, `1` means it fell below the minimum, and `2` means a usage
error or a failure to connect to the server.

## Does the Docker image lint stdio servers?

Yes, as long as the server runs on Node.js: the image includes `node` and `npx`. Mount the server
into the container, for example
`docker run --rm -v "$PWD:/work" ghcr.io/superintelligenceco/mcp-lint:0.2 -- node server.js`.
For a server in another language, use `--url`, the npm package, or a standalone executable.

## How do I verify a release download?

Every release has a `SHA256SUMS` file, and `install.sh` checks the download against it. The
release assets carry GitHub build provenance attestations, so you can also run
`gh attestation verify mcp-lint-linux-x64 --repo superintelligenceco/mcp-lint`. The container
image is signed with cosign keyless signing.
