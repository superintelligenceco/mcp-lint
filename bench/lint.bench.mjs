#!/usr/bin/env node
// Benchmarks the hot path, running every rule over a large server and scoring it, against the
// built package in dist/. Run `npm run build` first.
//
//   node bench/lint.bench.mjs            Compare with bench/baseline.json; exit 1 on a >2x slowdown
//   node bench/lint.bench.mjs --update   Write a new bench/baseline.json
//
// A JSON round-trip of the same snapshot measures the machine's speed. The check compares the
// ratio of the two, so a slow CI runner does not look like a regression.
import { readFileSync, writeFileSync } from "node:fs";
import { lint, parseSnapshot } from "../dist/index.js";

const MAX_SLOWDOWN = 2;
const baselineUrl = new URL("baseline.json", import.meta.url);

const load = (name) =>
  parseSnapshot(JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8")));
const messy = load("messy-server.json");
const clean = load("clean-server.json");

/** 240 tools: the messy and clean examples repeated with unique names. */
const large = {
  ...messy,
  tools: Array.from({ length: 30 }, (_, i) =>
    [...messy.tools, ...clean.tools].map((t) => ({ ...t, name: `${t.name}_${i}` })),
  ).flat(),
};
const text = JSON.stringify(large);

/** Median milliseconds per call over several timed batches, after a warm-up. */
function measure(fn, batch = 20, rounds = 15) {
  for (let i = 0; i < batch * 3; i++) fn();
  const samples = [];
  for (let r = 0; r < rounds; r++) {
    const start = performance.now();
    for (let i = 0; i < batch; i++) fn();
    samples.push((performance.now() - start) / batch);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

const referenceMs = measure(() => JSON.parse(text));
const lintMs = measure(() => lint(large));
const ratio = lintMs / referenceMs;
const result = {
  tools: large.tools.length,
  lintMs: Number(lintMs.toFixed(3)),
  referenceMs: Number(referenceMs.toFixed(3)),
  ratio: Number(ratio.toFixed(2)),
};

const lines = [
  "| Benchmark | Median |",
  "| --- | --- |",
  `| lint, ${result.tools} tools | ${result.lintMs} ms |`,
  `| reference JSON round-trip | ${result.referenceMs} ms |`,
  `| ratio | ${result.ratio} |`,
];

if (process.argv.includes("--update")) {
  writeFileSync(baselineUrl, `${JSON.stringify(result, null, 2)}\n`);
  console.log(lines.join("\n"));
  console.log("\nWrote bench/baseline.json");
} else {
  const baseline = JSON.parse(readFileSync(baselineUrl, "utf8"));
  const slowdown = ratio / baseline.ratio;
  lines.push(`| baseline ratio | ${baseline.ratio} |`, `| slowdown | ${slowdown.toFixed(2)}x |`);
  console.log(lines.join("\n"));
  if (slowdown > MAX_SLOWDOWN) {
    console.error(
      `\nlint is ${slowdown.toFixed(2)}x slower than the baseline (limit ${MAX_SLOWDOWN}x)`,
    );
    process.exit(1);
  }
}
