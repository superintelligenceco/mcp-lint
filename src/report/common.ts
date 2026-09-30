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

export function inventory(snapshot: Snapshot): string {
  const parts: string[] = [];
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
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
