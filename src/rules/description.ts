import type { Rule } from "../types.js";
import { nameWords } from "./helpers.js";

/** Phrases that describe nothing about what a tool does. */
const VAGUE_PATTERNS: RegExp[] = [
  /^(a |the )?(helper|utility|util|wrapper|handler|function|tool|method)( (function|tool|method))?\.?$/i,
  /^(does|do|handles?|processes|manages?) (stuff|things|it|the thing|everything)\.?$/i,
  /^(todo|tbd|fixme|n\/a|none|placeholder|description|test)\.?$/i,
  /^(this|a) tool( that)? (does|is) (something|stuff|things)\.?$/i,
];

function isVague(description: string, name: string): boolean {
  const text = description.trim();
  if (VAGUE_PATTERNS.some((re) => re.test(text))) return true;
  // A description that only restates the name, for example `get_user` => "Get user."
  const words = nameWords(text);
  const nameW = nameWords(name);
  return words.length > 0 && words.join(" ") === nameW.join(" ");
}

export const descriptionRules: Rule[] = [
  {
    id: "description/missing",
    category: "description",
    defaultSeverity: "error",
    summary: "Every tool and prompt has a description.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        if (typeof tool.description !== "string" || tool.description.trim() === "") {
          ctx.report({
            target: { kind: "tool", name: tool.name, path: "description" },
            message: "Tool has no description, so a model has to guess what it does from the name.",
          });
        }
      }
      for (const prompt of ctx.snapshot.prompts) {
        if (typeof prompt.description !== "string" || prompt.description.trim() === "") {
          ctx.report({
            severity: "warning",
            target: { kind: "prompt", name: prompt.name, path: "description" },
            message: "Prompt has no description.",
          });
        }
      }
    },
  },
  {
    id: "description/too-short",
    category: "description",
    defaultSeverity: "warning",
    summary: "Tool descriptions are long enough to explain what the tool does and when to use it.",
    check(ctx) {
      const min = ctx.options.descriptionMinLength;
      for (const tool of ctx.snapshot.tools) {
        const text = tool.description?.trim();
        if (!text) continue;
        if (text.length < min) {
          ctx.report({
            target: { kind: "tool", name: tool.name, path: "description" },
            message: `Description is ${text.length} characters; aim for at least ${min} that say what the tool does, when to use it, and what it returns.`,
          });
        }
      }
    },
  },
  {
    id: "description/too-long",
    category: "description",
    defaultSeverity: "info",
    summary: "Tool descriptions stay short enough not to crowd the model's context window.",
    check(ctx) {
      const max = ctx.options.descriptionMaxLength;
      for (const tool of ctx.snapshot.tools) {
        const text = tool.description?.trim();
        if (text && text.length > max) {
          ctx.report({
            target: { kind: "tool", name: tool.name, path: "description" },
            message: `Description is ${text.length} characters (limit ${max}). Every connected client pays for this text on every request.`,
          });
        }
      }
    },
  },
  {
    id: "description/vague",
    category: "description",
    defaultSeverity: "warning",
    summary: "Descriptions say something the tool name does not already say.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        const text = tool.description?.trim();
        if (text && isVague(text, tool.name)) {
          ctx.report({
            target: { kind: "tool", name: tool.name, path: "description" },
            message: `Description "${text}" is a placeholder or restates the name.`,
          });
        }
      }
    },
  },
];
