# Contributing to mcp-lint

Thanks for helping. This guide shows you how to set up the project, add a rule, and open a pull
request.

## Set up

You need Node.js 22.12 or later.

```sh
git clone https://github.com/superintelligenceco/mcp-lint.git
cd mcp-lint
npm ci
npm test
```

## Project layout

| Path | Contents |
| --- | --- |
| `src/collect.ts` | Connects to a live server over stdio, Streamable HTTP, or HTTP+SSE. |
| `src/snapshot.ts` | Loads and normalizes saved `tools/list` results. |
| `src/rules/` | One file per rule category. `rules/index.ts` registers them. |
| `src/lint.ts`, `src/score.ts` | Runs the rules and computes the score and grade. |
| `src/report/` | Text, JSON, Markdown, and SARIF reporters. |
| `src/main.ts` | CLI argument parsing and exit codes. |
| `test/` | Vitest unit tests, plus integration tests against `test/fixtures/server.mjs`. |

## Checks

Run these before you push. CI runs the same commands.

```sh
npm run lint        # Biome format and lint check
npm run typecheck   # TypeScript, strict mode
npm test            # Vitest
npm run build       # Compile to dist/
```

To fix formatting and safe lint issues automatically, run `npm run check`.

## Add a rule

1. Pick the category file in `src/rules/`, or add a new one and register it in
   `src/rules/index.ts`.
2. Give the rule an ID of the form `category/kebab-name`, a default severity, and a one-line
   `summary` that states what a passing server does.
3. Write messages that say what is wrong and how to fix it.
4. Add tests in `test/rules.test.ts` for at least one case that fires and one that does not. Use
   `goodTool()` from `test/helpers.ts` and change one field.
5. Add the rule to the rule reference table in `README.md`.

Keep false positives low. A rule that fires on well-built servers teaches people to turn it off.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and PR
  titles, for example `feat(rules): flag tools that accept raw SQL`. The release workflow builds
  the changelog from them.
- Keep each pull request focused on one change.
- Update `CHANGELOG.md` under `Unreleased` when behavior changes.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree
to uphold it.
