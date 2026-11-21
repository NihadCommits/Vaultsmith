import { fieldsOf, subtypeValues } from "./resolve";
import type { Config, FieldDef } from "./types";

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** "Vincent van Gogh" → "[[Vincent van Gogh]]"; already wrapped links stay as they are. */
export const toLink = (v: string) => (/^\[\[.*\]\]$/.test(v.trim()) ? v.trim() : `[[${v.trim()}]]`);

function normalize(field: FieldDef, value: unknown): unknown {
  const list = field.type === "list" || field.multiple;
  const items = (Array.isArray(value) ? value : [value]).filter((v) => !isEmpty(v));
  const one = (v: unknown): unknown => {
    if (field.type === "number") return typeof v === "number" ? v : Number(String(v).trim());
    if (field.type === "link") return toLink(String(v));
    return typeof v === "string" ? v.trim() : v;
  };
  const out = items.map(one).filter((v) => !(typeof v === "number" && Number.isNaN(v)));
  if (list) return out.length ? out : undefined;
  return out[0];
}

/**
 * Frontmatter object for a note of `schemaId`: subtype keys first, then fields in chain order.
 * Empty values are left out; list fields are always lists.
 */
export function buildFrontmatter(config: Config, schemaId: string, values: Record<string, unknown>): Record<string, unknown> {
  const fm: Record<string, unknown> = { ...subtypeValues(config, schemaId) };
  for (const field of fieldsOf(config, schemaId)) {
    const value = normalize(field, values[field.name]);
    if (value !== undefined) fm[field.name] = value;
  }
  return fm;
}

/** Names of required fields that are still empty. */
export function missingRequired(config: Config, schemaId: string, values: Record<string, unknown>): FieldDef[] {
  return fieldsOf(config, schemaId).filter((f) => f.required && normalize(f, values[f.name]) === undefined);
}

/** Initial values: each field's default, if it has one. */
export function defaultValues(config: Config, schemaId: string): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fieldsOf(config, schemaId)) if (field.default !== undefined) values[field.name] = field.default;
  return values;
}
