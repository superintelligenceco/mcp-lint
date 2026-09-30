import type { JsonSchema, Rule, Tool } from "../types.js";
import { isConstrainedString, nameWords, walkProperties } from "./helpers.js";

const SHELL_WORDS = new Set([
  "exec",
  "execute",
  "shell",
  "bash",
  "sh",
  "zsh",
  "powershell",
  "pwsh",
  "cmd",
  "eval",
  "spawn",
  "subprocess",
  "terminal",
]);
const SHELL_PARAMS = new Set(["command", "cmd", "script", "shell", "commandline", "command_line"]);

const WRITE_VERBS = new Set([
  "write",
  "delete",
  "remove",
  "rm",
  "move",
  "mv",
  "rename",
  "save",
  "create",
  "append",
  "edit",
  "overwrite",
  "upload",
  "mkdir",
  "unlink",
  "put",
  "patch",
  "update",
  "copy",
  "truncate",
]);
const FILE_WORDS = new Set(["file", "files", "dir", "directory", "folder", "path", "fs", "disk"]);
const PATH_PARAM =
  /(^|_|-)(path|paths|file|files|filename|filepath|dir|directory|folder|dest|destination|target)$/i;

const DESTRUCTIVE_VERBS = new Set([
  ...WRITE_VERBS,
  ...SHELL_WORDS,
  "run",
  "drop",
  "kill",
  "terminate",
  "purge",
  "wipe",
  "reset",
  "send",
  "post",
  "publish",
  "deploy",
  "transfer",
  "pay",
  "charge",
]);

/** A leading read verb means the tool reads something, as in `get_post` or `list_deploys`. */
const READ_VERBS = new Set([
  "get",
  "list",
  "read",
  "search",
  "fetch",
  "find",
  "query",
  "describe",
  "show",
  "view",
  "check",
  "count",
  "lookup",
]);

const URL_PARAM =
  /^(url|uri|urls|uris|endpoint|href|link|webhook|webhook_url|webhookurl|host|hostname|domain|base_url|baseurl)$/i;

function words(tool: Tool): string[] {
  return nameWords(tool.name);
}

function isStringish(schema: JsonSchema): boolean {
  const type = schema.type;
  return (
    type === undefined || type === "string" || (Array.isArray(type) && type.includes("string"))
  );
}

function stringParams(tool: Tool) {
  return [...walkProperties(tool.inputSchema)].filter((p) => isStringish(p.schema));
}

export const capabilityRules: Rule[] = [
  {
    id: "capability/shell-exec",
    category: "capability",
    defaultSeverity: "warning",
    summary: "Tools that run arbitrary shell commands are flagged for review.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        const w = words(tool);
        const byName =
          w.some((x) => SHELL_WORDS.has(x)) ||
          (w.includes("run") && (w.includes("command") || w.includes("script")));
        const param = stringParams(tool).find(
          (p) => SHELL_PARAMS.has(p.name.toLowerCase()) && !isConstrainedString(p.schema),
        );
        if (param) {
          ctx.report({
            target: { kind: "tool", name: tool.name, path: param.path },
            message: `Parameter "${param.name}" accepts an arbitrary command string. Constrain it with an enum or pattern, or document the sandbox it runs in.`,
          });
        } else if (byName) {
          ctx.report({
            target: { kind: "tool", name: tool.name },
            message:
              "Tool name suggests command execution. Confirm the inputs are allowlisted and the tool sets destructiveHint.",
          });
        }
      }
    },
  },
  {
    id: "capability/unconstrained-file-write",
    category: "capability",
    defaultSeverity: "warning",
    summary: "Tools that write, move, or delete files constrain the paths they accept.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        const w = words(tool);
        if (!w.some((x) => WRITE_VERBS.has(x))) continue;
        const params = stringParams(tool).filter((p) => PATH_PARAM.test(p.name));
        const namesFiles = w.some((x) => FILE_WORDS.has(x));
        if (params.length === 0 && !namesFiles) continue;
        for (const p of params) {
          if (!isConstrainedString(p.schema)) {
            ctx.report({
              target: { kind: "tool", name: tool.name, path: p.path },
              message: `Parameter "${p.name}" takes any path for a write operation. Add a pattern that confines it to an allowed root.`,
            });
          }
        }
      }
    },
  },
  {
    id: "capability/unconstrained-network",
    category: "capability",
    defaultSeverity: "warning",
    summary: "Tools that take a URL or host restrict where requests can go.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        for (const p of stringParams(tool)) {
          const looksLikeUrl =
            URL_PARAM.test(p.name) || p.schema.format === "uri" || p.schema.format === "url";
          if (!looksLikeUrl || isConstrainedString(p.schema)) continue;
          const declared = tool.annotations?.openWorldHint === true;
          ctx.report({
            severity: declared ? "info" : undefined,
            target: { kind: "tool", name: tool.name, path: p.path },
            message: declared
              ? `Parameter "${p.name}" accepts any URL; the tool declares openWorldHint, so confirm internal addresses are blocked.`
              : `Parameter "${p.name}" accepts any URL or host. Restrict it with a pattern or enum, or set openWorldHint and block internal addresses.`,
          });
        }
      }
    },
  },
  {
    id: "capability/missing-annotations",
    category: "capability",
    defaultSeverity: "info",
    summary:
      "Tools that change state declare readOnlyHint or destructiveHint annotations, and the hints match the name.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        const w = words(tool);
        const mutating = !READ_VERBS.has(w[0] ?? "") && w.some((x) => DESTRUCTIVE_VERBS.has(x));
        const ann = tool.annotations ?? {};
        if (mutating && ann.readOnlyHint === true) {
          ctx.report({
            severity: "warning",
            target: { kind: "tool", name: tool.name, path: "annotations.readOnlyHint" },
            message: "Tool name suggests it changes state, but it declares readOnlyHint: true.",
          });
        } else if (
          mutating &&
          ann.readOnlyHint === undefined &&
          ann.destructiveHint === undefined
        ) {
          ctx.report({
            target: { kind: "tool", name: tool.name, path: "annotations" },
            message:
              "Tool name suggests it changes state. Set annotations.destructiveHint (or readOnlyHint) so clients can ask before running it.",
          });
        }
      }
    },
  },
];
