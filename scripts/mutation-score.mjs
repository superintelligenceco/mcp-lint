#!/usr/bin/env node
// Prints the mutation score from Stryker's JSON report, for the workflow job summary.
import { existsSync, readFileSync } from "node:fs";

const path = "reports/mutation/mutation.json";
if (!existsSync(path)) {
  console.log("No mutation report was written.");
  process.exit(0);
}
const report = JSON.parse(readFileSync(path, "utf8"));
let killed = 0;
let total = 0;
for (const file of Object.values(report.files)) {
  for (const mutant of file.mutants) {
    if (mutant.status === "CompileError" || mutant.status === "Ignored") continue;
    total++;
    if (mutant.status === "Killed" || mutant.status === "Timeout") killed++;
  }
}
const score = total === 0 ? 100 : (100 * killed) / total;
console.log(`Mutation score: ${score.toFixed(1)}% (${killed} of ${total} mutants killed)`);
