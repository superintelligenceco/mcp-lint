# ADR 0001: Lint the model-facing surface, not the source code

- Status: accepted
- Date: 2026-09-30

## Context

MCP servers are written in TypeScript, Python, Go, Rust, and more. A source-level linter would
need a parser per language and would still miss metadata built at runtime, such as descriptions
loaded from a file or tools registered from a plugin list.

What a model sees is language-independent: the JSON that the server returns from `tools/list`,
`prompts/list`, and `resources/list`. Prompt injection, vague descriptions, and broken schemas all
live in that JSON.

## Decision

`mcp-lint` connects to a running server as an MCP client, or reads a saved list result, and lints
only that JSON. It does not read or parse the server's source code.

## Consequences

- One linter works for every server language and every SDK.
- Findings describe exactly what the model receives, including metadata assembled at runtime.
- SARIF locations point into a snapshot file, not into the server's source. Teams that want
  findings on their source commit a snapshot next to it.
- Some checks need a running server. `--save` and `--file` let CI lint a committed snapshot
  without starting it.
