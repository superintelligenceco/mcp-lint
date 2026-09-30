# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0](https://github.com/superintelligenceco/mcp-lint/releases/tag/v0.2.0) (2026-09-30)

### Features

- Publish to npm as `@superintelligenceco/mcp-lint`, with npm provenance.
- Ship standalone executables for Linux (x64, arm64), macOS (x64, arm64), and Windows (x64), an
  `install.sh` installer, and a multi-arch container image on GHCR signed with cosign.
- Attach SPDX SBOMs, `SHA256SUMS`, and build provenance attestations to every release.
- Add a documentation site on GitHub Pages with an FAQ, architecture notes, and decision records.

### Continuous integration

- Add OpenSSF Scorecard, dependency review, a link check, actionlint, a benchmark gate, a nightly
  run, and scheduled mutation testing.

## [0.1.0](https://github.com/superintelligenceco/mcp-lint/releases/tag/v0.1.0) (2026-09-30)

The first release of `mcp-lint`, a CLI and GitHub Action that lints and grades Model Context
Protocol servers.

### Features

- Connect to a server over stdio, Streamable HTTP, or HTTP+SSE, following `nextCursor`
  pagination for tools, prompts, resources, and resource templates.
- Lint a saved `tools/list` result, JSON-RPC response, or `--save` snapshot offline with `--file`.
- 21 rules in five categories:
  - Schema: missing or invalid `inputSchema`, invalid `outputSchema`, undocumented or untyped
    parameters, and `required` names that don't exist.
  - Description: missing, too short, too long, or vague descriptions.
  - Injection: instruction phrases aimed at the model, invisible and bidirectional-control
    Unicode, hidden HTML comments and instruction tags, and references to credential files.
  - Capability: shell execution, unconstrained file writes, unconstrained network access, and
    missing or contradictory tool annotations.
  - Naming: invalid tool names, duplicate names, and mixed casing styles.
- A score from 0 to 100 and a letter grade. Entity scores are averaged, and any prompt-injection
  error caps the score at 50.
- Text, JSON, Markdown, and SARIF 2.1.0 reports. SARIF results point at the line that defines
  each tool when you lint a file.
- Config file (`.mcp-lint.json` or `mcp-lint.config.json`) for rule severities, minimum score,
  ignored tools, and description length limits.
- Exit codes: `0` passed, `1` below the minimum score, `2` usage or connection error.
- A composite GitHub Action with `score`, `grade`, and `passed` outputs, a job summary, and
  optional SARIF upload to code scanning.
- A programmatic API: `lint`, `collect`, `readSnapshotFile`, the reporters, and the rule list.

### Bug fixes

- A server with any finding no longer rounds up to a score of 100.
- Reports use the singular for a count of one error or warning.
- `action.yml` is valid YAML; two input descriptions contained an unquoted colon.
