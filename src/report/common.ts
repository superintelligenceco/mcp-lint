import type { LintResult, Snapshot, Target } from "../types.js";

export interface ReportContext {
  result: LintResult;
  minScore: number;
}

export function passed(ctx: ReportContext): boolean {
  return ctx.result.score >= ctx.minScore;
}

export function describeTarget(target: Target): string {
  return target.kind === "server" ? "server" : `${target.kind} ${target.name}`;
}

/** Formats a count with its noun, adding "s" unless the count is 1. */
export function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** Summarizes finding counts, for example "1 error, 2 warnings, 0 info". */
export function countsSummary(result: LintResult): string {
  const { error, warning, info } = result.counts;
  return `${count(error, "error")}, ${count(warning, "warning")}, ${info} info`;
}

export function inventory(snapshot: Snapshot): string {
  const parts: string[] = [];
  parts.push(count(snapshot.tools.length, "tool"));
  if (snapshot.prompts.length) parts.push(count(snapshot.prompts.length, "prompt"));
  if (snapshot.resources.length) parts.push(count(snapshot.resources.length, "resource"));
  if (snapshot.resourceTemplates.length) {
    parts.push(count(snapshot.resourceTemplates.length, "resource template"));
  }
  return parts.join(", ");
}

export function serverLabel(snapshot: Snapshot): string | undefined {
  const s = snapshot.server;
  if (!s?.name) return undefined;
  return s.version ? `${s.name} ${s.version}` : s.name;
}
