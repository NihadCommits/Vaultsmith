import {
  COLORS,
  FIELD_TYPES,
  type CatalogDef,
  type Config,
  type FieldDef,
  type Issue,
  type RawFile,
  type SchemaDef,
} from "./types";

export interface BuildResult {
  /** Only set when there are no errors (warnings are fine). */
  config?: Config;
  issues: Issue[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const baseName = (path: string) => path.split("/").pop()!.replace(/\.json$/i, "");

/**
 * Parses and checks all config files. `exists` checks vault paths (folders, templates);
 * without it those warnings are skipped.
 */
export function buildConfig(
  schemaFiles: RawFile[],
  catalogFiles: RawFile[],
  exists?: (path: string) => boolean,
): BuildResult {
  const issues: Issue[] = [];
  const error = (file: string | undefined, message: string) => issues.push({ level: "error", file, message });
  const warn = (file: string | undefined, message: string) => issues.push({ level: "warning", file, message });

  const parse = (f: RawFile): unknown => {
    try {
      return JSON.parse(f.text);
    } catch (e) {
      error(f.path, `Invalid JSON: ${(e as Error).message}`);
      return undefined;
    }
  };

  // Catalogs
  const catalogs = new Map<string, CatalogDef>();
  const catalogFile = new Map<string, string>();
  for (const f of catalogFiles) {
    const raw = parse(f);
    if (raw === undefined) continue;
    if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.label) || !Array.isArray(raw.values)) {
      error(f.path, 'A catalog needs "id", "label" and "values".');
      continue;
    }
    if (raw.id !== baseName(f.path)) {
      error(f.path, `Catalog id "${raw.id}" must match the file name "${baseName(f.path)}.json".`);
    }
    if (catalogs.has(raw.id)) {
      error(f.path, `Duplicate catalog id "${raw.id}" (also in ${catalogFile.get(raw.id)}).`);
      continue;
    }
    const seen = new Set<string>();
    for (const value of raw.values) {
      if (!isObj(value) || !isStr(value.id) || !isStr(value.label)) {
        error(f.path, 'Every catalog value needs "id" and "label".');
        continue;
      }
      if (seen.has(value.id)) error(f.path, `Duplicate value id "${value.id}".`);
      seen.add(value.id);
      if (value.color !== undefined && !(COLORS as readonly unknown[]).includes(value.color)) {
        warn(f.path, `Value "${value.id}": unknown color "${String(value.color)}". Use one of: ${COLORS.join(", ")}.`);
      }
    }
    catalogs.set(raw.id, raw as unknown as CatalogDef);
    catalogFile.set(raw.id, f.path);
  }

  // Schemas: shape
  const schemas = new Map<string, SchemaDef>();
  const schemaFile = new Map<string, string>();
  for (const f of schemaFiles) {
    const raw = parse(f);
    if (raw === undefined) continue;
    if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.label)) {
      error(f.path, 'A schema needs "id" and "label".');
      continue;
    }
    if (schemas.has(raw.id)) {
      error(f.path, `Duplicate schema id "${raw.id}" (also in ${schemaFile.get(raw.id)}).`);
      continue;
    }
    if (raw.fields !== undefined && !Array.isArray(raw.fields)) {
      error(f.path, `Schema "${raw.id}": "fields" must be a list.`);
      continue;
    }
    let fieldsOk = true;
    for (const field of (raw.fields as unknown[] | undefined) ?? []) {
      if (!isObj(field) || !isStr(field.name) || !isStr(field.label) || !isStr(field.type)) {
        error(f.path, `Schema "${raw.id}": every field needs "name", "label" and "type".`);
        fieldsOk = false;
      } else if (!(FIELD_TYPES as readonly string[]).includes(field.type)) {
        error(f.path, `Schema "${raw.id}", field "${field.name}": unknown type "${field.type}". Use one of: ${FIELD_TYPES.join(", ")}.`);
        fieldsOk = false;
      }
    }
    if (!fieldsOk) continue;
    schemas.set(raw.id, raw as unknown as SchemaDef);
    schemaFile.set(raw.id, f.path);
  }

  // Schemas: tree
  const roots = [...schemas.values()].filter((s) => s.extends === undefined);
  if (schemas.size === 0) error(undefined, "No schemas found.");
  else if (roots.length !== 1) {
    error(undefined, `Exactly one schema must have no "extends" (the root). Found ${roots.length}: ${roots.map((s) => s.id).join(", ") || "none"}.`);
  }
  for (const s of schemas.values()) {
    if (s.extends === undefined) continue;
    const parent = schemas.get(s.extends);
    if (!parent) error(schemaFile.get(s.id), `Schema "${s.id}" extends unknown schema "${s.extends}".`);
    else if (!parent.subtypeField) {
      error(schemaFile.get(s.id), `Schema "${s.id}" extends "${parent.id}", but "${parent.id}" has no "subtypeField".`);
    }
  }
  const inCycle = new Set<string>();
  for (const s of schemas.values()) {
    const seen = new Set<string>();
    let cur: SchemaDef | undefined = s;
    while (cur?.extends !== undefined) {
      if (seen.has(cur.id)) {
        if (!inCycle.has(s.id)) error(schemaFile.get(s.id), `Schema "${s.id}" is part of an "extends" cycle.`);
        seen.forEach((id) => inCycle.add(id));
        break;
      }
      seen.add(cur.id);
      cur = schemas.get(cur.extends);
    }
  }

  // Fields
  const subtypeFields = new Set([...schemas.values()].map((s) => s.subtypeField).filter(isStr));
  const fieldTypes = new Map<string, { field: FieldDef; schema: string }>();
  for (const s of schemas.values()) {
    const file = schemaFile.get(s.id);
    for (const field of s.fields ?? []) {
      const where = `Schema "${s.id}", field "${field.name}"`;
      if (subtypeFields.has(field.name)) error(file, `${where}: this name is already used as a "subtypeField".`);
      if (field.type === "choice") {
        const catalog = field.catalog === undefined ? undefined : catalogs.get(field.catalog);
        if (!catalog) error(file, `${where}: catalog "${field.catalog ?? ""}" not found.`);
        else if (field.default !== undefined) {
          const defaults = Array.isArray(field.default) ? field.default : [field.default];
          for (const d of defaults) {
            if (!catalog.values.some((value) => value.id === d)) {
              error(file, `${where}: default "${String(d)}" is not in catalog "${catalog.id}".`);
            }
          }
        }
      }
      if (field.type === "link" && field.target !== undefined && !schemas.has(field.target)) {
        error(file, `${where}: link target "${field.target}" is not a schema.`);
      }
      // Obsidian property types are vault-wide, so one name must keep one type everywhere.
      const seen = fieldTypes.get(field.name);
      if (!seen) fieldTypes.set(field.name, { field, schema: s.id });
      else if (seen.field.type !== field.type || !!seen.field.multiple !== !!field.multiple) {
        error(file, `${where}: type differs from schema "${seen.schema}". A property name must have the same type everywhere.`);
      }
    }
    if (exists) {
      if (s.defaultFolder && !exists(s.defaultFolder)) warn(file, `Schema "${s.id}": folder "${s.defaultFolder}" does not exist yet.`);
      if (s.template && !exists(s.template)) warn(file, `Schema "${s.id}": template "${s.template}" not found.`);
    }
  }

  if (issues.some((i) => i.level === "error")) return { issues };

  const children = new Map<string, SchemaDef[]>();
  for (const s of schemas.values()) {
    if (s.extends === undefined) continue;
    children.set(s.extends, [...(children.get(s.extends) ?? []), s]);
  }
  return { config: { schemas, catalogs, catalogPaths: catalogFile, root: roots[0], children }, issues };
}
