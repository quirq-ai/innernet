import "server-only";

import Ajv, { type ErrorObject } from "ajv";
import fs from "node:fs";
import path from "node:path";
import defaults from "../innernet.ui.json";
import schema from "../innernet.ui.schema.json";
import overrideSchema from "../innernet.ui.override.schema.json";
import { formatUiText, type UiConfig, type UiTextValues } from "./ui-config-shared";
export type { BrandLogo, UiConfig } from "./ui-config-shared";

// Colours are values in a small grammar, never arbitrary declarations or URLs.
function safeColor(value: string): boolean {
  if (/^#[0-9a-f]{3}(?:[0-9a-f]|[0-9a-f]{3}|[0-9a-f]{5})?$/i.test(value)) return true;
  const rgb = value.match(/^rgb\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)(?: \/ (0(?:\.\d+)?|1(?:\.0+)?))?\)$/);
  if (rgb) return rgb.slice(1, 4).every((n) => Number(n) <= 255);
  const oklch = value.match(/^oklch\((0(?:\.\d+)?|1(?:\.0+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)(?: \/ (0(?:\.\d+)?|1(?:\.0+)?))?\)$/);
  return !!oklch && Number(oklch[2]) <= 0.5 && Number(oklch[3]) <= 360;
}
function safeLink(value: string): boolean {
  if (/^\/(?!\/)[A-Za-z0-9_./:#?=&%+-]*$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !/[\s<>"\\]/.test(value);
  } catch { return false; }
}
const ajv = new Ajv({ allErrors: true, strict: true, ownProperties: true });
ajv.addFormat("ui-color", { type: "string", validate: safeColor });
ajv.addFormat("ui-link", { type: "string", validate: safeLink });
const validate = ajv.compile<UiConfig>(schema);
const validateOverride = ajv.compile(overrideSchema);

function fieldPath(error: ErrorObject): string {
  const suffix = error.keyword === "additionalProperties" ? error.params.additionalProperty
    : error.keyword === "required" ? error.params.missingProperty : null;
  return `${error.instancePath || ""}${suffix ? `/${suffix}` : ""}` || "/";
}
function checked(value: unknown, filename: string): UiConfig {
  if (!validate(value)) {
    const messages = (validate.errors ?? []).map((error) => `${fieldPath(error)} ${error.message}`);
    throw new Error(`Invalid UI configuration in ${filename}:\n${messages.join("\n")}`);
  }
  const config = value as UiConfig;
  for (const key of ["searchWidth", "articleWidth"] as const) {
    if (config.layout[key] > config.layout.maxWidth) throw new Error(`Invalid UI configuration in ${filename}: /layout/${key} must not exceed /layout/maxWidth`);
  }
  return config;
}
export function validateUiOverride(value: unknown, filename = "UI override"): void {
  if (!validateOverride(value)) {
    const messages = (validateOverride.errors ?? []).map((error) => `${fieldPath(error)} ${error.message}`);
    throw new Error(`Invalid UI configuration in ${filename}:\n${messages.join("\n")}`);
  }
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Arrays replace; objects merge by key, without assigning to object prototypes. */
function merge(base: unknown, override: unknown): unknown {
  if (!isObject(base) || !isObject(override)) return structuredClone(override);
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    Object.defineProperty(result, key, { value: merge(base[key], value), enumerable: true, writable: true, configurable: true });
  }
  return result;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const shippedDefaults = checked(defaults, "innernet.ui.json (shipped defaults)");

/** Used by the check script as well as the disk loader. */
export function resolveUiConfig(override: unknown = {}, filename = "UI override"): UiConfig {
  validateUiOverride(override, filename);
  return freeze(checked(merge(shippedDefaults, override), filename));
}
function readJson(filename: string): unknown {
  try { return JSON.parse(fs.readFileSync(filename, "utf8")); }
  catch (error) { throw new Error(`Cannot read UI configuration ${filename}: ${error instanceof Error ? error.message : String(error)}`); }
}
function fileVersion(filename: string): string {
  try {
    const stat = fs.statSync(filename);
    return `${filename}:${stat.mtimeMs}:${stat.size}:${stat.ino}`;
  } catch (error) { throw new Error(`Cannot read UI configuration ${filename}: ${error instanceof Error ? error.message : String(error)}`); }
}
let cache: { version: string; config: UiConfig } | null = null;

/** UI-only file loading. Appearance changes never require rebuilding the index. */
export function getUiConfig(): UiConfig {
  const defaultFile = path.join(process.cwd(), "innernet.ui.json");
  const overrideFile = process.env.INNERNET_UI_CONFIG ? path.resolve(process.env.INNERNET_UI_CONFIG) : null;
  const version = `${fileVersion(defaultFile)}|${overrideFile ? fileVersion(overrideFile) : ""}`;
  if (cache?.version === version) return cache.config;
  const currentDefaults = checked(readJson(defaultFile), defaultFile);
  let config = currentDefaults;
  if (overrideFile) {
    const override = readJson(overrideFile);
    validateUiOverride(override, overrideFile);
    config = checked(merge(currentDefaults, override), overrideFile);
  }
  cache = { version, config: freeze(config) };
  return cache.config;
}
export function uiText(key: string, values?: UiTextValues, config = getUiConfig()): string {
  return formatUiText(config, key, values);
}
