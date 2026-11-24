import { managedKeys } from "./edit";
import { missingRequired } from "./frontmatter";
import { chainOf, detectSchema, fieldsOf } from "./resolve";
import type { CatalogDef, CatalogValue, Config } from "./types";

type Fm = Record<string, unknown>;

/** Field names (in any schema) that store values of this catalog. */
export function catalogFieldNames(config: Config, catalogId: string): Set<string> {
  const names = new Set<string>();
  for (const s of config.schemas.values()) {
    for (const f of s.fields ?? []) if (f.type === "choice" && f.catalog === catalogId) names.add(f.name);
  }
  return names;
}

const valuesIn = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

/** How many notes use `valueId` in a field backed by `catalogId`. */
export function countUsage(config: Config, notes: Fm[], catalogId: string, valueId: string): number {
  const names = catalogFieldNames(config, catalogId);
  return notes.filter((fm) => [...names].some((n) => valuesIn(fm[n]).includes(valueId))).length;
}

/** Replaces `oldId` with `newId` in the given fields; returns true if anything changed. Duplicates in lists are dropped. */
export function renameValue(fm: Fm, fieldNames: Set<string>, oldId: string, newId: string): boolean {
  let changed = false;
  for (const name of fieldNames) {
    const v = fm[name];
    if (v === oldId) {
      fm[name] = newId;
      changed = true;
    } else if (Array.isArray(v) && v.includes(oldId)) {
      fm[name] = [...new Set(v.map((x) => (x === oldId ? newId : x)))];
      changed = true;
    }
  }
  return changed;
}

/** Catalog edits return a new catalog; the caller writes it to disk. */
export function updateValue(catalog: CatalogDef, id: string, patch: Partial<CatalogValue>): CatalogDef {
  return { ...catalog, values: catalog.values.map((v) => (v.id === id ? clean({ ...v, ...patch }) : v)) };
}

export function moveValue(catalog: CatalogDef, id: string, direction: 1 | -1): CatalogDef {
  const values = [...catalog.values];
  const i = values.findIndex((v) => v.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= values.length) return catalog;
  [values[i], values[j]] = [values[j], values[i]];
  return { ...catalog, values };
}

export function removeValue(catalog: CatalogDef, id: string): CatalogDef {
  return { ...catalog, values: catalog.values.filter((v) => v.id !== id) };
}

/** Drops empty optional keys so the JSON stays tidy. */
function clean(v: CatalogValue): CatalogValue {
  const out: CatalogValue = { id: v.id, label: v.label };
  if (v.color) out.color = v.color;
  if (v.aliases?.length) out.aliases = v.aliases;
  if (v.description?.trim()) out.description = v.description.trim();
  return out;
}

/**
 * Problems of one note against the config. `expectType`: the note lies in a folder that
 * some schema uses as default folder, so a missing type is worth reporting.
 */
export function lintNote(config: Config, fm: Fm | null | undefined, expectType: boolean): string[] {
  const detection = detectSchema(config, fm);
  if (!detection || !fm) return expectType ? ["No type"] : [];
  const problems: string[] = [];
  const { schema, unknown } = detection;
  if (unknown) problems.push(`Unknown ${unknown.field} "${String(unknown.value)}"`);
  else if (schema.abstract) problems.push(`"${schema.label}" needs a subtype`);

  const fields = fieldsOf(config, schema.id);
  const allowed = new Set([...fields.map((f) => f.name), ...chainOf(config, schema.id).map((s) => s.subtypeField).filter((k): k is string => !!k)]);
  for (const key of Object.keys(fm)) {
    if (managedKeys(config).has(key) && !allowed.has(key)) problems.push(`"${key}" does not belong to ${schema.label}`);
  }
  for (const f of fields) {
    if (f.type !== "choice" || !f.catalog) continue;
    const catalog = config.catalogs.get(f.catalog);
    for (const v of valuesIn(fm[f.name])) {
      if (!catalog?.values.some((c) => c.id === v)) problems.push(`${f.label}: "${String(v)}" is not in ${catalog?.label ?? f.catalog}`);
    }
  }
  if (!unknown) for (const f of missingRequired(config, schema.id, fm)) problems.push(`${f.label} is missing`);
  return problems;
}
