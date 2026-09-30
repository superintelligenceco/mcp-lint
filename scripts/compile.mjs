#!/usr/bin/env node
// Builds a standalone mcp-lint executable with `bun build --compile`.
// Usage: node scripts/compile.mjs <outfile> [bun-target]
// Example: node scripts/compile.mjs out/mcp-lint-linux-arm64 bun-linux-arm64
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [outfile, target] = process.argv.slice(2);
if (!outfile) {
  console.error("usage: node scripts/compile.mjs <outfile> [bun-target]");
  process.exit(2);
}

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const args = [
  "build",
  "src/cli.ts",
  "--compile",
  "--minify",
  "--define",
  `MCP_LINT_VERSION=${JSON.stringify(version)}`,
  "--outfile",
  outfile,
];
if (target) args.push(`--target=${target}`);

const result = spawnSync(process.env.BUN ?? "bun", args, { stdio: "inherit" });
if (result.error) {
  console.error(`could not run bun: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
