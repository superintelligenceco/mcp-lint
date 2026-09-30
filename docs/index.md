# mcp-lint

`mcp-lint` lints and grades Model Context Protocol (MCP) servers before an agent ever calls them.

It connects to a server over stdio, Streamable HTTP, or HTTP+SSE, or reads a saved `tools/list`
result. It lists the tools, prompts, and resources, then checks them for broken JSON schemas,
vague descriptions, prompt-injection surfaces, and dangerous capabilities. You get a score from 0
to 100, a letter grade, and reports in text, JSON, Markdown, or SARIF.

![mcp-lint grading a messy MCP server](assets/demo.gif)

## Install

=== "npm"

    ```sh
    npx @superintelligenceco/mcp-lint --help
    npm install --global @superintelligenceco/mcp-lint
    ```

=== "Executable"

    ```sh
    curl -fsSL https://raw.githubusercontent.com/superintelligenceco/mcp-lint/main/install.sh | sh
    ```

=== "Docker"

    ```sh
    docker run --rm ghcr.io/superintelligenceco/mcp-lint:0.2 --help
    ```

## What it checks

| Category | Examples |
| --- | --- |
| Schema | Missing or invalid `inputSchema`, untyped parameters, `required` names that do not exist |
| Description | Missing, too short, too long, or vague descriptions |
| Injection | "Ignore previous instructions", invisible Unicode, hidden HTML comments, `~/.ssh` references |
| Capability | Shell execution, unconstrained file writes and network access, missing annotations |
| Naming | Invalid tool names, duplicates, mixed casing styles |

The [README](https://github.com/superintelligenceco/mcp-lint#rule-reference) lists all 21 rules
with their default severities.

## Next steps

- [Getting started](getting-started.md) walks through a first run, CI gating, and configuration.
- [Architecture](architecture.md) shows how a run flows from a server to a report.
- [FAQ](faq.md) answers common questions about scores, false positives, and transports.
- [Decisions](adr/index.md) records why the tool works the way it does.
