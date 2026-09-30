import type { Rule } from "../types.js";
import { capabilityRules } from "./capability.js";
import { descriptionRules } from "./description.js";
import { injectionRules } from "./injection.js";
import { namingRules } from "./naming.js";
import { schemaRules } from "./schema.js";

export const rules: Rule[] = [
  ...schemaRules,
  ...descriptionRules,
  ...injectionRules,
  ...capabilityRules,
  ...namingRules,
];

export function getRule(id: string): Rule | undefined {
  return rules.find((r) => r.id === id);
}
