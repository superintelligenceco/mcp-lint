#!/usr/bin/env node
// Builds a standalone mcp-lint executable with `bun build --compile`, or, with the target `node`,
// a single-file JavaScript bundle that runs on Node.js with no node_modules (used by the image).
// Usage: node scripts/compile.mjs <outfile> [bun-target|node]
// Examples:
//   node scripts/compile.mjs out/mcp-lint-linux-arm64 bun-linux-arm64
//   bun scripts/compile.mjs out/cli.js node
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
  "--minify",
  "--define",
  `MCP_LINT_VERSION=${JSON.stringify(version)}`,
  "--outfile",
  outfile,
];
if (target === "node") args.push("--target=node");
else {
  args.push("--compile");
  if (target) args.push(`--target=${target}`);
}

const result = spawnSync(process.env.BUN ?? "bun", args, { stdio: "inherit" });
if (result.error) {
  console.error(`could not run bun: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
