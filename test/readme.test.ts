// Keeps README.md honest: the sample output, the commands it tells you to run, the usage block,
// the options table, and the rule reference must all match what the CLI does today.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitCommandLine } from "../src/argv.js";
import { HELP, main } from "../src/main.js";
import { rules } from "../src/rules/index.js";

const README = readFileSync(new URL("../README.md", import.meta.url), "utf8");

function codeBlocks(lang: string): string[] {
  const re = new RegExp(`\`\`\`${lang}\\n([\\s\\S]*?)\`\`\``, "g");
  return [...README.matchAll(re)].map((m) => m[1] as string);
}

async function run(argv: string[]) {
  let stdout = "";
  const code = await main(argv, {
    stdout: (s) => {
      stdout += s;
    },
    stderr: () => {},
    isTTY: false,
    cwd: process.cwd(),
    env: {},
  });
  return { code, stdout };
}

describe("README", () => {
  it("shows real output for the console example", async () => {
    const [block] = codeBlocks("console");
    expect(block).toBeDefined();
    const [prompt, ...shown] = (block as string).trimEnd().split("\n");
    expect(prompt).toMatch(/^\$ mcp-lint /);
    const { stdout } = await run(splitCommandLine((prompt as string).slice("$ mcp-lint ".length)));
    const actual = stdout.split("\n").map((l) => l.trimEnd());
    for (const line of shown) {
      if (line === "..." || line === "") continue;
      expect(actual).toContain(line.trimEnd());
    }
  });

  it("runs every offline command it shows", async () => {
    const commands = codeBlocks("sh")
      .flatMap((b) => b.split("\n"))
      .map((l) => l.trim())
      .filter((l) => /^(mcp-lint|node dist\/cli\.js) /.test(l) && l.includes("--file examples/"));
    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) {
      const argv = splitCommandLine(command).slice(command.startsWith("node ") ? 2 : 1);
      const { code, stdout } = await run(argv);
      expect([0, 1], command).toContain(code);
      expect(stdout, command).toMatch(/Score \d+\/100 {2}Grade [A-F]/);
    }
  });

  it("documents the same usage lines as --help", () => {
    const usage = codeBlocks("text").find((b) => b.includes("--file <tools.json>"));
    expect(usage).toBeDefined();
    for (const line of (usage as string).trim().split("\n")) {
      expect(HELP).toContain(line.replace(/^mcp-lint/, "  mcp-lint"));
    }
  });

  it("only lists options that the CLI accepts", () => {
    const flags = [...README.matchAll(/^\| `(-{1,2}[a-z][^`]*)` \|/gm)].flatMap((m) =>
      (m[1] as string).match(/--?[a-z][a-z-]*/g),
    );
    expect(flags.length).toBeGreaterThan(5);
    for (const flag of flags) expect(HELP).toContain(flag as string);
  });

  it("lists every rule with its default severity", () => {
    const table = new Map(
      [...README.matchAll(/^\| `([a-z]+\/[a-z-]+)` \| (error|warning|info) \|/gm)].map((m) => [
        m[1],
        m[2],
      ]),
    );
    expect(table.size).toBe(rules.length);
    for (const rule of rules) expect(table.get(rule.id), rule.id).toBe(rule.defaultSeverity);
  });
});
