import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, parseConfig } from "../src/config.js";
import { DEFAULT_CONFIG } from "../src/lint.js";

describe("parseConfig", () => {
  it("merges over defaults", () => {
    const c = parseConfig({
      rules: { "description/vague": "off" },
      minScore: 85,
      options: { descriptionMinLength: 40 },
    });
    expect(c.rules["description/vague"]).toBe("off");
    expect(c.minScore).toBe(85);
    expect(c.options).toEqual({ descriptionMinLength: 40, descriptionMaxLength: 1024 });
    expect(DEFAULT_CONFIG.options.descriptionMinLength).toBe(20);
  });

  it.each([
    [[], /JSON object/],
    [{ nope: 1 }, /unknown key "nope"/],
    [{ rules: { "made/up": "error" } }, /unknown rule "made\/up"/],
    [{ rules: { "description/vague": "loud" } }, /must be one of/],
    [{ minScore: 101 }, /minScore/],
    [{ ignoreTools: "a" }, /ignoreTools/],
    [{ options: { colour: 1 } }, /unknown option/],
    [{ options: { descriptionMinLength: "5" } }, /non-negative number/],
  ])("rejects %j", (raw, message) => {
    expect(() => parseConfig(raw)).toThrow(ConfigError);
    expect(() => parseConfig(raw)).toThrow(message);
  });
});

describe("loadConfig", () => {
  it("discovers .mcp-lint.json and falls back to defaults", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-lint-"));
    expect(loadConfig(undefined, dir)).toEqual(DEFAULT_CONFIG);
    writeFileSync(join(dir, ".mcp-lint.json"), JSON.stringify({ minScore: 90 }));
    expect(loadConfig(undefined, dir).minScore).toBe(90);
  });

  it("reports malformed JSON with the file name", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-lint-"));
    writeFileSync(join(dir, "bad.json"), "{");
    expect(() => loadConfig("bad.json", dir)).toThrow(/bad\.json/);
  });
});
