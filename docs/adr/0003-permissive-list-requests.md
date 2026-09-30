# ADR 0003: Send raw list requests instead of the SDK's typed helpers

- Status: accepted
- Date: 2026-09-30

## Context

The TypeScript SDK's `client.listTools()` validates the response against the MCP schema and throws
when a tool breaks it, for example when `inputSchema` is missing. Those broken tools are exactly
what `mcp-lint` needs to report. Using the typed helpers would turn a lint finding into a
connection error with exit code 2.

## Decision

`collect.ts` sends `tools/list`, `prompts/list`, `resources/list`, and `resources/templates/list`
with `client.request()` and a permissive Zod schema that only requires an optional `nextCursor`.
The rules then validate each item themselves and report problems as findings.

## Consequences

- A malformed server produces a report with specific findings instead of a crash.
- The rules cannot assume well-formed input. Every rule treats fields as untrusted, and a
  property-based test feeds `lint` random tools to check that it never throws.
- Pagination stays under our control: `collect.ts` follows `nextCursor` for at most 100 pages, so
  a server that returns the same cursor forever cannot hang a CI job.
