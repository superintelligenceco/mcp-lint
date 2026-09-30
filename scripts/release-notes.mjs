#!/usr/bin/env node
// Prints the CHANGELOG.md section for one version, for use as GitHub Release notes.
// Usage: node scripts/release-notes.mjs <version>   (with or without a leading "v")
import { readFileSync } from "node:fs";

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!version) {
  console.error("usage: node scripts/release-notes.mjs <version>");
  process.exit(2);
}

const lines = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").split("\n");
const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
if (start === -1) {
  console.error(`CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
if (end === -1) end = lines.length;
process.stdout.write(`${lines.slice(start + 1, end).join("\n").trim()}\n`);
