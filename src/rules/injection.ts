import type { Rule } from "../types.js";
import { textSurfaces, truncate } from "./helpers.js";

/**
 * Phrases that address the model instead of describing a capability. These are
 * the building blocks of tool-poisoning attacks, where a server smuggles
 * instructions into metadata the user never sees.
 */
const INSTRUCTION_PATTERNS: { re: RegExp; label: string }[] = [
  {
    re: /\b(ignore|disregard|forget|override)\s+(all\s+|any\s+)?(of\s+)?(the\s+|your\s+)?(previous|prior|above|earlier|preceding|original|system)\s+(instructions?|prompts?|messages?|rules|context|directions)/i,
    label: "tells the model to ignore earlier instructions",
  },
  {
    re: /\b(do\s+not|don'?t|never)\s+(tell|inform|mention|reveal|disclose|show|notify|alert)\s+(this\s+)?(to\s+)?the\s+user/i,
    label: "tells the model to hide something from the user",
  },
  {
    re: /\bwithout\s+(telling|informing|notifying|alerting|asking)\s+the\s+user/i,
    label: "tells the model to act without the user's knowledge",
  },
  {
    re: /\b(the\s+)?user\s+(must|should)\s+not\s+(know|see|be\s+told)/i,
    label: "tells the model to hide something from the user",
  },
  { re: /\byou\s+are\s+now\b/i, label: "tries to reassign the model's role" },
  {
    re: /\b(reveal|print|output|repeat|leak)\s+(your|the)\s+(system\s+prompt|instructions|hidden\s+prompt)/i,
    label: "asks the model to leak its instructions",
  },
  { re: /^\s*(system|assistant)\s*:/im, label: "impersonates a chat role" },
  {
    re: /\[\/?INST\]|<\|im_(start|end)\|>|<\|(system|assistant)\|>/,
    label: "contains chat-template control tokens",
  },
];

/** Markup commonly used to make injected text stand out to a model or hide it from a UI. */
const MARKUP_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /<!--[\s\S]*?-->/, label: "an HTML comment" },
  {
    re: /<\s*\/?\s*(important|system|instructions?|secret|hidden|admin|override)\b[^>]*>/i,
    label: "an instruction-style tag",
  },
];

/** File paths and variables that a legitimate tool description rarely needs to mention. */
const SENSITIVE_PATTERNS: RegExp[] = [
  /~\/\.ssh\b|\bid_(rsa|ed25519|ecdsa)\b/,
  /\.aws\/credentials|\.config\/gcloud|\.kube\/config|\.docker\/config\.json/,
  /\/etc\/(passwd|shadow)\b/,
  /\b(mcp|claude_desktop_config|cursor)\.json\b/i,
  /(^|[\s/"'`(])\.env\b/,
  /\b(AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY)\b/,
];

/**
 * Code points that render as nothing (or reorder text) in most UIs, so a
 * reviewer cannot see what the model reads. Keep these as escapes so the
 * source file itself stays free of invisible characters.
 */
export const HIDDEN_CHARS =
  /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]|[\u{E0000}-\u{E007F}]/gu;

export function hiddenCodePoints(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(HIDDEN_CHARS)) {
    const cp = match[0].codePointAt(0) ?? 0;
    found.add(`U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
  }
  return [...found];
}

export const injectionRules: Rule[] = [
  {
    id: "injection/instruction-phrases",
    category: "injection",
    defaultSeverity: "error",
    summary:
      "Metadata does not contain instructions aimed at the model, such as 'ignore previous instructions'.",
    check(ctx) {
      for (const surface of textSurfaces(ctx.snapshot)) {
        for (const { re, label } of INSTRUCTION_PATTERNS) {
          const match = re.exec(surface.text);
          if (match) {
            ctx.report({
              target: surface.target,
              message: `The ${surface.field} ${label}: "${truncate(match[0])}".`,
            });
            break;
          }
        }
      }
    },
  },
  {
    id: "injection/hidden-unicode",
    category: "injection",
    defaultSeverity: "error",
    summary: "Metadata contains no invisible or bidirectional-control characters.",
    check(ctx) {
      for (const surface of textSurfaces(ctx.snapshot)) {
        const cps = hiddenCodePoints(surface.text);
        if (cps.length > 0) {
          ctx.report({
            target: surface.target,
            message: `The ${surface.field} contains invisible characters (${cps.join(", ")}) that a reviewer cannot see but a model reads.`,
          });
        }
      }
    },
  },
  {
    id: "injection/hidden-markup",
    category: "injection",
    defaultSeverity: "warning",
    summary: "Metadata contains no HTML comments or instruction-style tags such as <IMPORTANT>.",
    check(ctx) {
      for (const surface of textSurfaces(ctx.snapshot)) {
        for (const { re, label } of MARKUP_PATTERNS) {
          const match = re.exec(surface.text);
          if (match) {
            ctx.report({
              target: surface.target,
              message: `The ${surface.field} contains ${label}: "${truncate(match[0])}".`,
            });
            break;
          }
        }
      }
    },
  },
  {
    id: "injection/sensitive-reference",
    category: "injection",
    defaultSeverity: "warning",
    summary:
      "Metadata does not reference credential files, SSH keys, or secret environment variables.",
    check(ctx) {
      for (const surface of textSurfaces(ctx.snapshot)) {
        for (const re of SENSITIVE_PATTERNS) {
          const match = re.exec(surface.text);
          if (match) {
            ctx.report({
              target: surface.target,
              message: `The ${surface.field} references a sensitive location: "${match[0]}".`,
            });
            break;
          }
        }
      }
    },
  },
];
