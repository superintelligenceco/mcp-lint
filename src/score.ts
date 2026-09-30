import type { EntityScore, Finding, Grade, Severity, Snapshot } from "./types.js";

/** Points one finding removes from the score of the tool, prompt, or resource it targets. */
export const SEVERITY_WEIGHT: Record<Severity, number> = { error: 25, warning: 8, info: 2 };

/** A server with any prompt-injection error scores at most this, whatever else it gets right. */
export const INJECTION_CAP = 50;

export const GRADE_THRESHOLDS: [Grade, number][] = [
  ["A", 90],
  ["B", 80],
  ["C", 70],
  ["D", 60],
  ["F", 0],
];

export function gradeFor(score: number): Grade {
  for (const [grade, min] of GRADE_THRESHOLDS) {
    if (score >= min) return grade;
  }
  return "F";
}

function key(kind: string, name: string): string {
  return `${kind}\u0000${name}`;
}

/**
 * Scores each entity from 100 down, averages the entity scores, then subtracts
 * server-level findings. Averaging keeps one weak tool from sinking a large,
 * otherwise clean server, while the injection cap keeps one poisoned tool from
 * hiding behind many clean ones.
 */
export function computeScore(
  snapshot: Snapshot,
  findings: Finding[],
): { score: number; entities: EntityScore[] } {
  const entities = new Map<string, EntityScore>();
  const add = (kind: EntityScore["kind"], name: string) => {
    if (!entities.has(key(kind, name))) entities.set(key(kind, name), { kind, name, score: 100 });
  };
  for (const t of snapshot.tools) add("tool", t.name);
  for (const p of snapshot.prompts) add("prompt", p.name);
  for (const r of snapshot.resources) add("resource", r.uri);
  for (const r of snapshot.resourceTemplates) add("resourceTemplate", r.uriTemplate);

  let serverPenalty = 0;
  for (const f of findings) {
    const entity = entities.get(key(f.target.kind, f.target.name));
    if (entity) {
      entity.score = Math.max(0, entity.score - SEVERITY_WEIGHT[f.severity]);
    } else {
      serverPenalty += SEVERITY_WEIGHT[f.severity];
    }
  }

  const list = [...entities.values()];
  const mean = list.length === 0 ? 100 : list.reduce((sum, e) => sum + e.score, 0) / list.length;
  let score = Math.max(0, Math.round(mean - serverPenalty));
  if (findings.some((f) => f.severity === "error" && f.ruleId.startsWith("injection/"))) {
    score = Math.min(score, INJECTION_CAP);
  }
  return { score, entities: list };
}
