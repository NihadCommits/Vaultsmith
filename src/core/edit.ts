import { subtypeValues } from "./resolve";
import type { Config } from "./types";

/** Keys Vaultsmith owns: every subtype key and every field name of any schema. Everything else is left alone. */
export function managedKeys(config: Config): Set<string> {
  const keys = new Set<string>();
  for (const s of config.schemas.values()) {
    if (s.subtypeField) keys.add(s.subtypeField);
    for (const f of s.fields ?? []) keys.add(f.name);
  }
  return keys;
}

/** Managed keys the note has now but would lose with `next` (type change or emptied field). */
export function removedKeys(config: Config, current: Record<string, unknown>, next: Record<string, unknown>): string[] {
  const managed = managedKeys(config);
  return Object.keys(current).filter((k) => managed.has(k) && !(k in next));
}

/** Form values from existing frontmatter: everything except the subtype keys. */
export function valuesFromFrontmatter(config: Config, schemaId: string | undefined, fm: Record<string, unknown>): Record<string, unknown> {
  const subtype = new Set(Object.keys(schemaId ? subtypeValues(config, schemaId) : {}));
  for (const s of config.schemas.values()) if (s.subtypeField) subtype.add(s.subtypeField);
  return Object.fromEntries(Object.entries(fm).filter(([k]) => !subtype.has(k)));
}

/** Aliases after a rename: the old name is added unless it's already there or equals the new name. */
export function aliasesAfterRename(aliases: string[], oldName: string, newName: string, keepOld: boolean): string[] {
  const out = [...aliases];
  const lower = (s: string) => s.trim().toLowerCase();
  if (keepOld && lower(oldName) !== lower(newName) && !out.some((a) => lower(a) === lower(oldName))) out.push(oldName);
  return out;
}
