import { createRequire } from "node:module";

/**
 * Set at build time by `bun build --compile --define` for standalone executables, which have no
 * package.json next to them. Undefined when mcp-lint runs from the npm package.
 */
declare const MCP_LINT_VERSION: string | undefined;

function readVersion(): string {
  if (typeof MCP_LINT_VERSION === "string") return MCP_LINT_VERSION;
  const require = createRequire(import.meta.url);
  return (require("../package.json") as { version: string }).version;
}

/** The package version, read from package.json so it never drifts from the release. */
export const VERSION: string = readVersion();
