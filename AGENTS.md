# AGENTS.md

Guidance for coding agents that work in this repository.

## Commands

- Install: `npm ci`
- Format and lint check: `npm run lint` (Biome). Fix with `npm run check`.
- Typecheck: `npm run typecheck`
- Test: `npm test` (Vitest; integration tests spawn `test/fixtures/server.mjs`)
- Build: `npm run build` (writes `dist/`, which is gitignored)

Run lint, typecheck, and test before you finish a change. All three must pass.

## Conventions

- TypeScript in strict mode, ES modules, Node 22.12 or later. Import local files with a `.js`
  extension.
- No `any` and no non-null assertions; Biome rejects both.
- Keep runtime dependencies to `@modelcontextprotocol/sdk`, `ajv`, and `zod`. Ask before adding one.
- Each rule lives in `src/rules/<category>.ts`, has an ID of the form `category/kebab-name`, and
  has tests that cover both a finding and a clean case.
- A rule change that affects scores must update `test/score.test.ts` and the README.
- Commit messages follow Conventional Commits.

## Boundaries

- Don't commit `dist/`, `node_modules/`, coverage output, or generated reports.
- Don't weaken a test to make it pass. Fix the code or explain why the test was wrong.
- Don't put secrets, tokens, or machine-specific paths in fixtures or examples.
