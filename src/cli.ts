#!/usr/bin/env node
import { main } from "./main.js";

const code = await main(process.argv.slice(2), {
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
  isTTY: Boolean(process.stdout.isTTY),
  cwd: process.cwd(),
  env: process.env,
});
process.exitCode = code;
