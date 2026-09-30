import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CollectError, collect } from "../src/collect.js";
import { lint } from "../src/lint.js";
import { main } from "../src/main.js";

const SERVER = resolve(import.meta.dirname, "fixtures/server.mjs");

async function run(argv: string[], cwd = process.cwd()) {
  let stdout = "";
  let stderr = "";
  const code = await main(argv, {
    stdout: (s) => {
      stdout += s;
    },
    stderr: (s) => {
      stderr += s;
    },
    isTTY: false,
    cwd,
    env: {},
  });
  return { code, stdout, stderr };
}

describe("stdio server", () => {
  it("collects every page of tools plus prompts and resources", async () => {
    const snapshot = await collect({
      type: "stdio",
      command: process.execPath,
      args: [SERVER, "messy"],
    });
    expect(snapshot.server).toEqual({ name: "fixture-messy", version: "1.0.0" });
    // The fixture pages tools two at a time; all six must arrive, including the
    // spec-violating one without an inputSchema.
    expect(snapshot.tools.map((t) => t.name)).toEqual([
      "run_command",
      "write_file",
      "fetchUrl",
      "get_weather",
      "helper",
      "search docs",
    ]);
    expect(snapshot.prompts).toHaveLength(1);
    expect(snapshot.resources).toHaveLength(1);
  });

  it("grades the clean fixture A with no findings", async () => {
    const res = await run(["--", process.execPath, SERVER, "clean"]);
    expect(res.stderr).toBe("");
    expect(res.stdout).toContain("No problems found.");
    expect(res.stdout).toContain("Grade A");
    expect(res.code).toBe(0);
  });

  it("fails the messy fixture and reports each class of problem", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-lint-int-"));
    const res = await run(
      [
        "--stdio",
        `"${process.execPath}" "${SERVER}" messy`,
        "--format",
        "json",
        "--save",
        "snap.json",
      ],
      dir,
    );
    expect(res.code).toBe(1);
    const report = JSON.parse(res.stdout);
    expect(report.grade).toBe("F");
    const ids = new Set(report.findings.map((f: { ruleId: string }) => f.ruleId));
    for (const id of [
      "schema/missing-input-schema",
      "schema/invalid-input-schema",
      "schema/missing-param-description",
      "description/too-short",
      "description/vague",
      "injection/instruction-phrases",
      "injection/hidden-unicode",
      "injection/hidden-markup",
      "injection/sensitive-reference",
      "capability/shell-exec",
      "capability/unconstrained-file-write",
      "capability/unconstrained-network",
      "naming/invalid-tool-name",
      "naming/inconsistent-style",
    ]) {
      expect(ids, id).toContain(id);
    }

    // A saved snapshot lints to the same result in static mode.
    const saved = JSON.parse(readFileSync(join(dir, "snap.json"), "utf8"));
    const again = await run(["--file", "snap.json", "--format", "json"], dir);
    expect(JSON.parse(again.stdout).score).toBe(report.score);
    expect(lint(saved).score).toBe(report.score);
  });

  it("surfaces server stderr when the command fails", async () => {
    await expect(
      collect(
        {
          type: "stdio",
          command: process.execPath,
          args: ["-e", "console.error('boom'); process.exit(3)"],
        },
        { timeout: 5000 },
      ),
    ).rejects.toThrow(CollectError);
    const res = await run([
      "--timeout",
      "5000",
      "--",
      process.execPath,
      "-e",
      "console.error('boom'); process.exit(3)",
    ]);
    expect(res.code).toBe(2);
    expect(res.stderr).toContain("boom");
  });
});

describe("Streamable HTTP server", () => {
  let child: ChildProcess;
  let url = "";

  beforeAll(async () => {
    child = spawn(process.execPath, [SERVER, "clean", "--http", "0"], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    url = await new Promise<string>((resolvePort, reject) => {
      child.once("error", reject);
      child.stdout?.on("data", (chunk: Buffer) => {
        const match = /listening (\d+)/.exec(chunk.toString());
        if (match) resolvePort(`http://127.0.0.1:${match[1]}/mcp`);
      });
    });
  });

  afterAll(() => {
    child?.kill();
  });

  it("lints a server over HTTP", async () => {
    const res = await run(["--url", url, "--header", "X-Test: 1", "--format", "json"]);
    expect(res.stderr).toBe("");
    const report = JSON.parse(res.stdout);
    expect(report.server.name).toBe("fixture-clean");
    expect(report.inventory).toEqual({ tools: 2, prompts: 1, resources: 1, resourceTemplates: 0 });
    expect(report.grade).toBe("A");
  });

  it("reports an unreachable URL as a usage error", async () => {
    const res = await run(["--url", "http://127.0.0.1:9/mcp", "--timeout", "3000"]);
    expect(res.code).toBe(2);
    expect(res.stderr).toContain("Could not read from");
  });
});
