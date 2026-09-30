import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONFIG } from "./lint.js";
import { isObject } from "./rules/helpers.js";
import { getRule } from "./rules/index.js";
import type { Config, RuleSetting } from "./types.js";

export const CONFIG_FILES = [".mcp-lint.json", "mcp-lint.config.json"];
const SETTINGS: RuleSetting[] = ["error", "warning", "info", "off"];

export class ConfigError extends Error {}

/** Validates a parsed config object and merges it over the defaults. */
export function parseConfig(raw: unknown, source = "config"): Config {
  if (!isObject(raw)) throw new ConfigError(`${source}: expected a JSON object`);
  const config: Config = structuredClone(DEFAULT_CONFIG);
  for (const key of Object.keys(raw)) {
    if (!["$schema", "rules", "minScore", "ignoreTools", "options"].includes(key)) {
      throw new ConfigError(`${source}: unknown key "${key}"`);
    }
  }
  if (raw.rules !== undefined) {
    if (!isObject(raw.rules)) throw new ConfigError(`${source}: "rules" must be an object`);
    for (const [id, value] of Object.entries(raw.rules)) {
      if (!getRule(id)) throw new ConfigError(`${source}: unknown rule "${id}"`);
      if (!SETTINGS.includes(value as RuleSetting)) {
        throw new ConfigError(`${source}: rule "${id}" must be one of ${SETTINGS.join(", ")}`);
      }
      config.rules[id] = value as RuleSetting;
    }
  }
  if (raw.minScore !== undefined) {
    if (typeof raw.minScore !== "number" || raw.minScore < 0 || raw.minScore > 100) {
      throw new ConfigError(`${source}: "minScore" must be a number from 0 to 100`);
    }
    config.minScore = raw.minScore;
  }
  if (raw.ignoreTools !== undefined) {
    if (!Array.isArray(raw.ignoreTools) || !raw.ignoreTools.every((t) => typeof t === "string")) {
      throw new ConfigError(`${source}: "ignoreTools" must be an array of strings`);
    }
    config.ignoreTools = raw.ignoreTools;
  }
  if (raw.options !== undefined) {
    if (!isObject(raw.options)) throw new ConfigError(`${source}: "options" must be an object`);
    for (const [key, value] of Object.entries(raw.options)) {
      if (!(key in config.options)) throw new ConfigError(`${source}: unknown option "${key}"`);
      if (typeof value !== "number" || value < 0) {
        throw new ConfigError(`${source}: option "${key}" must be a non-negative number`);
      }
      config.options[key as keyof Config["options"]] = value;
    }
  }
  return config;
}

/** Loads an explicit config file, or the first default config file found in `cwd`. */
export function loadConfig(path: string | undefined, cwd = process.cwd()): Config {
  const file = path
    ? resolve(cwd, path)
    : CONFIG_FILES.map((f) => resolve(cwd, f)).find((f) => existsSync(f));
  if (!file) return structuredClone(DEFAULT_CONFIG);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new ConfigError(`${file}: ${(error as Error).message}`);
  }
  return parseConfig(raw, file);
}
