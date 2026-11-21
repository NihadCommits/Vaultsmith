import { detectSchema, fieldsOf } from "./resolve";
import type { CatalogDef, Config, FieldDef } from "./types";

export interface StatusInfo {
  field: FieldDef;
  catalog: CatalogDef;
  /** Stored value, undefined if the note has none yet. */
  value: string | undefined;
  /** Position in the catalog, -1 if unset or unknown. */
  index: number;
  /** False when the stored value is not in the catalog (e.g. typed by hand). */
  valid: boolean;
}

/**
 * The status field of a note: a choice field named `fieldName` in the note's type chain
 * (or on the root, for notes without type that still have the property). Null = no status bar.
 */
export function statusInfo(config: Config, fm: Record<string, unknown> | null | undefined, fieldName: string): StatusInfo | null {
  const detection = detectSchema(config, fm);
  if (!detection && fm?.[fieldName] === undefined) return null;
  const fields = detection ? fieldsOf(config, detection.schema.id) : config.root.fields ?? [];
  const field = fields.find((f) => f.name === fieldName && f.type === "choice" && !f.multiple && f.catalog);
  const catalog = field?.catalog === undefined ? undefined : config.catalogs.get(field.catalog);
  if (!field || !catalog) return null;
  const raw = fm?.[fieldName];
  const value = raw === undefined || raw === null || raw === "" ? undefined : String(raw);
  const index = value === undefined ? -1 : catalog.values.findIndex((v) => v.id === value);
  return { field, catalog, value, index, valid: value === undefined || index >= 0 };
}

/** Id one stage forward (+1) or back (-1); null at the edges or when the value is invalid. */
export function stepStatus(info: StatusInfo, direction: 1 | -1): string | null {
  if (!info.valid) return null;
  if (info.index < 0) return direction > 0 ? info.catalog.values[0]?.id ?? null : null;
  return info.catalog.values[info.index + direction]?.id ?? null;
}
