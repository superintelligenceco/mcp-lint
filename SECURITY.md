# Security policy

## Supported versions

Security fixes land on the latest minor release.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Report a vulnerability

Don't open a public issue for a security problem. Report it privately through
[GitHub private vulnerability reporting](https://github.com/superintelligenceco/mcp-lint/security/advisories/new).

Include the version, the command you ran, and the smallest input that reproduces the problem. You
get an acknowledgment within 5 business days. After the fix ships, the advisory is published with
credit to you unless you ask otherwise.

## Scope

`mcp-lint` starts the stdio command you give it and connects to the URL you give it. Running an
untrusted server through `mcp-lint` is as risky as running that server directly, so use `--file`
with a saved `tools/list` result, or a sandbox, for servers you don't trust.

In scope:

- Code execution or file writes triggered by the contents of a `--file` input or by server
  metadata.
- Reports (text, JSON, Markdown, SARIF) that a crafted server can use to inject content into a
  terminal, a job summary, or GitHub code scanning.
- A crafted server that makes `mcp-lint` hide findings or report a passing score it did not earn.

A missed detection by a rule is a bug, not a vulnerability. Open a regular issue for it.
