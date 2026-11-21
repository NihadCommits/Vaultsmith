import type { Config, FieldDef, SchemaDef } from "./types";

/** Root first, the schema itself last. */
export function chainOf(config: Config, id: string): SchemaDef[] {
  const chain: SchemaDef[] = [];
  let cur = config.schemas.get(id);
  while (cur) {
    chain.unshift(cur);
    cur = cur.extends === undefined ? undefined : config.schemas.get(cur.extends);
  }
  return chain;
}

/** Inherited fields first; a field with the same name in a subtype replaces the parent's in place. */
export function fieldsOf(config: Config, id: string): FieldDef[] {
  const fields: FieldDef[] = [];
  for (const schema of chainOf(config, id)) {
    for (const field of schema.fields ?? []) {
      const i = fields.findIndex((f) => f.name === field.name);
      if (i >= 0) fields[i] = field;
      else fields.push(field);
    }
  }
  return fields;
}

const deepest = <K extends "defaultFolder" | "template">(config: Config, id: string, key: K) =>
  [...chainOf(config, id)].reverse().find((s) => s[key] !== undefined)?.[key];

export const folderOf = (config: Config, id: string) => deepest(config, id, "defaultFolder");
export const templateOf = (config: Config, id: string) => deepest(config, id, "template");

/** The subtype keys a note of this schema gets, e.g. { type: "entity", entity_type: "work", work_type: "painting" }. */
export function subtypeValues(config: Config, id: string): Record<string, string> {
  const chain = chainOf(config, id);
  const values: Record<string, string> = {};
  for (let i = 0; i < chain.length - 1; i++) values[chain[i].subtypeField!] = chain[i + 1].id;
  return values;
}

/** True if `id` is `ancestorId` or one of its subtypes (used for link targets). */
export const isWithin = (config: Config, id: string, ancestorId: string) =>
  chainOf(config, id).some((s) => s.id === ancestorId);

export interface Detection {
  /** Deepest schema the frontmatter matches. */
  schema: SchemaDef;
  /** Set when a subtype key holds a value no schema knows. */
  unknown?: { field: string; value: unknown };
}

/** Reads the subtype keys of a note's frontmatter. Null if the note has no root subtype key. */
export function detectSchema(config: Config, fm: Record<string, unknown> | null | undefined): Detection | null {
  const rootKey = config.root.subtypeField;
  if (!fm || !rootKey || fm[rootKey] === undefined || fm[rootKey] === null || fm[rootKey] === "") return null;
  let current = config.root;
  while (current.subtypeField) {
    const value = fm[current.subtypeField];
    if (value === undefined || value === null || value === "") break;
    const child = (config.children.get(current.id) ?? []).find((c) => c.id === value);
    if (!child) return { schema: current, unknown: { field: current.subtypeField, value } };
    current = child;
  }
  return { schema: current };
}
