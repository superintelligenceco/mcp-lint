import { VERSION } from "../version.js";
import { passed, type ReportContext } from "./common.js";

export function toJson(ctx: ReportContext) {
  const { result } = ctx;
  return {
    tool: "mcp-lint",
    version: VERSION,
    server: result.snapshot.server ?? null,
    score: result.score,
    grade: result.grade,
    minScore: ctx.minScore,
    passed: passed(ctx),
    counts: result.counts,
    inventory: {
      tools: result.snapshot.tools.length,
      prompts: result.snapshot.prompts.length,
      resources: result.snapshot.resources.length,
      resourceTemplates: result.snapshot.resourceTemplates.length,
    },
    findings: result.findings,
    entities: result.entities,
  };
}

export function formatJson(ctx: ReportContext): string {
  return `${JSON.stringify(toJson(ctx), null, 2)}\n`;
}
