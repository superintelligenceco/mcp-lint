#!/usr/bin/env node
// Records docs/assets/demo.cast, an asciicast v2 file of real mcp-lint runs. Each command runs in a
// pseudo-terminal through script(1), so the output keeps its colors. Render the GIF with agg:
//
//   npm run build && node scripts/record-demo.mjs && agg docs/assets/demo.cast docs/assets/demo.gif
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cols = 118;
const rows = 34;
const commands = [
  "mcp-lint --file examples/messy-server.json",
  "mcp-lint -- node test/fixtures/server.mjs clean",
];

// Put the built CLI on PATH as `mcp-lint`, the name that npm and install.sh give it.
const bin = mkdtempSync(join(tmpdir(), "mcp-lint-demo-"));
const cli = join(root, "dist", "cli.js");
chmodSync(cli, 0o755);
symlinkSync(cli, join(bin, "mcp-lint"));

const events = [];
let t = 0.5;
const emit = (text, delay) => {
  t += delay;
  events.push([Number(t.toFixed(3)), "o", text]);
};
const prompt = "\u001b[1;32m$\u001b[0m ";

for (const command of commands) {
  emit(prompt, 0.4);
  for (const ch of command) emit(ch, 0.045);
  emit("\r\n", 0.5);
  let out;
  try {
    out = execFileSync("script", ["-qec", command, "/dev/null"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, COLUMNS: String(cols) },
    });
  } catch (error) {
    // A failing grade exits 1; the output is still what the demo shows.
    out = error.stdout;
  }
  for (const line of out.replace(/\r?\n$/, "").split(/\r?\n/)) emit(`${line}\r\n`, 0.06);
  emit("", 2.5);
}
emit(prompt, 0.2);
emit("", 2);

const header = { version: 2, width: cols, height: rows, env: { TERM: "xterm-256color" } };
mkdirSync(join(root, "docs", "assets"), { recursive: true });
const file = join(root, "docs", "assets", "demo.cast");
writeFileSync(file, `${[header, ...events].map((e) => JSON.stringify(e)).join("\n")}\n`);
console.log(`Wrote ${file}`);
