# Getting started

## Lint a saved snapshot

The repository ships two example snapshots. Lint the messy one:

```sh
npx @superintelligenceco/mcp-lint --file examples/messy-server.json
```

The last lines of the report show the score, the grade, and whether the run passed:

```text
Score 50/100  Grade F  (6 errors, 10 warnings, 3 info)
Failed: score is below the minimum of 70.
```

The exit code is `1` because the score is below the default minimum of 70.

## Lint a running server

Put a stdio server's command after `--`:

```sh
mcp-lint -- npx -y @modelcontextprotocol/server-everything
```

For a remote server, pass `--url`. `mcp-lint` tries Streamable HTTP first and falls back to
HTTP+SSE:

```sh
mcp-lint --url https://mcp.example.com/mcp -H "Authorization: Bearer $MCP_TOKEN"
```

## Gate a pull request

Save a snapshot once, commit it, and lint it in CI without starting the server:

```sh
mcp-lint --save mcp-snapshot.json -- node dist/server.js
mcp-lint --file mcp-snapshot.json --min-score 85 --sarif mcp-lint.sarif
```

Or use the GitHub Action, which also uploads SARIF to code scanning:

```yaml
- uses: superintelligenceco/mcp-lint@v0.2.0
  with:
    command: node dist/server.js
    min-score: "80"
    upload-sarif: "true"
```

## Configure rules

Put a `.mcp-lint.json` in the working directory:

```json
{
  "minScore": 80,
  "rules": { "naming/inconsistent-style": "off" },
  "ignoreTools": ["debug_dump"]
}
```

Unknown keys and unknown rule IDs are errors, so a typo cannot silently disable a rule.

## Use the library

```ts
import { lint, readSnapshotFile } from "@superintelligenceco/mcp-lint";

const { snapshot } = readSnapshotFile("tools.json");
const result = lint(snapshot);
console.log(result.score, result.grade, result.findings.length);
```
