# Examples

| File | What it shows |
| --- | --- |
| [`clean-server.json`](clean-server.json) | A saved `tools/list` result that scores 100 (grade A). |
| [`messy-server.json`](messy-server.json) | A saved result with one of each common problem. It scores 50 (grade F). |
| [`mcp-lint.config.json`](mcp-lint.config.json) | A config file that raises the bar and tunes rule severities. |
| [`github-workflow.yml`](github-workflow.yml) | A workflow that lints a server on every pull request and uploads SARIF. |

Try them from the repository root after `npm ci && npm run build`:

```sh
node dist/cli.js --file examples/clean-server.json
node dist/cli.js --file examples/messy-server.json --config examples/mcp-lint.config.json
node dist/cli.js --file examples/messy-server.json --format sarif --output messy.sarif
```
