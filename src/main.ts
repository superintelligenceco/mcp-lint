import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { splitCommandLine } from "./argv.js";
import { collect, type ServerTarget } from "./collect.js";
import { loadConfig } from "./config.js";
import { lint } from "./lint.js";
import type { ReportContext } from "./report/common.js";
import { formatJson } from "./report/json.js";
import { formatMarkdown } from "./report/markdown.js";
import { formatSarif, type SarifOptions } from "./report/sarif.js";
import { formatText } from "./report/text.js";
import { rules } from "./rules/index.js";
import { readSnapshotFile, serializeSnapshot } from "./snapshot.js";
import type { Snapshot } from "./types.js";
import { VERSION } from "./version.js";

const FORMATS = ["text", "json", "sarif", "markdown"] as const;
type Format = (typeof FORMATS)[number];

export const HELP = `mcp-lint ${VERSION}
Lint and grade a Model Context Protocol server.

Usage:
  mcp-lint [options] -- <command> [args...]   Launch a stdio server and lint it
  mcp-lint [options] --url <url>              Lint a Streamable HTTP (or SSE) server
  mcp-lint [options] --file <tools.json>      Lint a saved tools/list response

Target options:
  -f, --file <path>        Saved tools/list result, JSON-RPC response, or --save snapshot
  -u, --url <url>          Server URL; tries Streamable HTTP, then HTTP+SSE
  -H, --header <k: v>      HTTP header for --url (repeatable)
      --stdio <cmdline>    Server command as one string, for example "node server.js"
  -e, --env <KEY=VALUE>    Extra environment variable for a stdio server (repeatable)
      --timeout <ms>       Connection and request timeout (default 30000)

Output options:
      --format <fmt>       text, json, sarif, or markdown (default text)
  -o, --output <path>      Write the report to a file instead of stdout
      --json <path>        Also write a JSON report to this path
      --sarif <path>       Also write a SARIF report to this path
      --markdown <path>    Also write a Markdown report to this path
      --sarif-uri <path>   File that SARIF results point at (default: the --file path)
      --save <path>        Save the collected snapshot for later --file runs
      --no-color           Disable colors (also respects NO_COLOR)

Policy options:
  -c, --config <path>      Config file (default: .mcp-lint.json or mcp-lint.config.json)
      --min-score <n>      Exit 1 when the score is below n (default 70)
      --list-rules         Print every rule and exit
  -v, --version            Print the version and exit
  -h, --help               Print this help and exit

Exit codes: 0 passed, 1 score below minimum, 2 usage or connection error.
`;

export interface CliIo {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  isTTY: boolean;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

class UsageError extends Error {}

function parseKeyValue(values: string[], sep: string, flag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of values) {
    const i = v.indexOf(sep);
    if (i <= 0) throw new UsageError(`${flag} expects "name${sep}value", got "${v}"`);
    out[v.slice(0, i).trim()] = v.slice(i + 1).trim();
  }
  return out;
}

function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function listRules(): string {
  const width = Math.max(...rules.map((r) => r.id.length));
  return `${rules.map((r) => `${r.id.padEnd(width)}  ${r.defaultSeverity.padEnd(7)}  ${r.summary}`).join("\n")}\n`;
}

/** Runs the CLI and returns the process exit code. */
export async function main(argv: string[], io: CliIo): Promise<number> {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.stderr(`mcp-lint: ${(error as Error).message}\nRun "mcp-lint --help" for usage.\n`);
    return 2;
  }
  const { values, positionals } = parsed;

  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  if (values.version) {
    io.stdout(`${VERSION}\n`);
    return 0;
  }
  if (values["list-rules"]) {
    io.stdout(listRules());
    return 0;
  }

  try {
    const format = (values.format ?? "text") as Format;
    if (!FORMATS.includes(format)) {
      throw new UsageError(`--format must be one of ${FORMATS.join(", ")}`);
    }
    const config = loadConfig(values.config, io.cwd);
    let minScore = config.minScore;
    if (values["min-score"] !== undefined) {
      minScore = Number(values["min-score"]);
      if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
        throw new UsageError("--min-score must be a number from 0 to 100");
      }
    }
    const timeout = values.timeout === undefined ? 30_000 : Number(values.timeout);
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new UsageError("--timeout must be a positive number of milliseconds");
    }

    const command = values.stdio ? splitCommandLine(values.stdio) : positionals;
    const targets = [values.file, values.url, command.length ? "stdio" : undefined].filter(Boolean);
    if (targets.length === 0) {
      throw new UsageError("give a server to lint: --file, --url, or -- <command>");
    }
    if (targets.length > 1) throw new UsageError("give only one of --file, --url, or a command");

    let snapshot: Snapshot;
    let artifactText: string | undefined;
    let artifactUri = values["sarif-uri"];
    if (values.file) {
      const path = resolve(io.cwd, values.file);
      const loaded = readSnapshotFile(path);
      snapshot = loaded.snapshot;
      if (!artifactUri) {
        artifactUri = relative(io.cwd, path).split("\\").join("/");
        artifactText = loaded.text;
      }
    } else {
      let target: ServerTarget;
      if (values.url) {
        target = {
          type: "http",
          url: values.url,
          headers: parseKeyValue(values.header ?? [], ":", "--header"),
        };
      } else {
        const [cmd, ...args] = command as [string, ...string[]];
        target = {
          type: "stdio",
          command: cmd,
          args,
          cwd: io.cwd,
          env: parseKeyValue(values.env ?? [], "=", "--env"),
        };
      }
      snapshot = await collect(target, { timeout });
    }
    if (values.save) {
      writeFile(resolve(io.cwd, values.save), serializeSnapshot(snapshot));
    }

    const result = lint(snapshot, config);
    const ctx: ReportContext = { result, minScore };
    const sarifOptions: SarifOptions = {
      artifactUri: artifactUri ?? "mcp-server.json",
      artifactText,
    };
    const color = values.color !== false && io.isTTY && !values.output && !io.env.NO_COLOR;
    const render = (fmt: Format) => {
      switch (fmt) {
        case "json":
          return formatJson(ctx);
        case "sarif":
          return formatSarif(ctx, sarifOptions);
        case "markdown":
          return formatMarkdown(ctx);
        default:
          return formatText(ctx, color);
      }
    };

    if (values.output) writeFile(resolve(io.cwd, values.output), render(format));
    else io.stdout(render(format));
    if (values.json) writeFile(resolve(io.cwd, values.json), render("json"));
    if (values.sarif) writeFile(resolve(io.cwd, values.sarif), render("sarif"));
    if (values.markdown) writeFile(resolve(io.cwd, values.markdown), render("markdown"));

    return result.score >= minScore ? 0 : 1;
  } catch (error) {
    io.stderr(`mcp-lint: ${(error as Error).message}\n`);
    return 2;
  }
}

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    strict: true,
    options: {
      file: { type: "string", short: "f" },
      url: { type: "string", short: "u" },
      header: { type: "string", short: "H", multiple: true },
      stdio: { type: "string" },
      env: { type: "string", short: "e", multiple: true },
      timeout: { type: "string" },
      format: { type: "string" },
      output: { type: "string", short: "o" },
      json: { type: "string" },
      sarif: { type: "string" },
      markdown: { type: "string" },
      "sarif-uri": { type: "string" },
      save: { type: "string" },
      color: { type: "boolean" },
      config: { type: "string", short: "c" },
      "min-score": { type: "string" },
      "list-rules": { type: "boolean" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });
}
