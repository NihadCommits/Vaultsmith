export const FIELD_TYPES = ["text", "number", "date", "list", "choice", "link"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Obsidian theme colors usable for catalog values (rendered as var(--color-<name>)). */
export const COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"] as const;

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  default?: unknown;
  /** choice / link only: store a list instead of a single value. */
  multiple?: boolean;
  /** choice only: catalog id. */
  catalog?: string;
  /** link only: schema id; matches that schema and all its subtypes. */
  target?: string;
}

export interface SchemaDef {
  id: string;
  label: string;
  extends?: string;
  /** Cannot be picked directly; a subtype must be chosen. */
  abstract?: boolean;
  /** YAML key that stores the id of the chosen subtype. */
  subtypeField?: string;
  defaultFolder?: string;
  template?: string;
  fields?: FieldDef[];
}

export interface CatalogValue {
  id: string;
  label: string;
  aliases?: string[];
  description?: string;
  color?: string;
}

export interface CatalogDef {
  id: string;
  label: string;
  values: CatalogValue[];
}

export interface RawFile {
  path: string;
  text: string;
}

export interface Issue {
  level: "error" | "warning";
  file?: string;
  message: string;
}

export interface Config {
  schemas: Map<string, SchemaDef>;
  catalogs: Map<string, CatalogDef>;
  /** Vault path of each catalog file, for writing new values. */
  catalogPaths: Map<string, string>;
  root: SchemaDef;
  /** Direct subtypes per schema id, in load order. */
  children: Map<string, SchemaDef[]>;
}
