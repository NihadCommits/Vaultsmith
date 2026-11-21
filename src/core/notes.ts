/** What Vaultsmith needs to know about an existing note. */
export interface NoteInfo {
  path: string;
  basename: string;
  aliases: string[];
}

export interface Duplicate {
  note: NoteInfo;
  /** The name or alias that matched. */
  matched: string;
}

/** Notes whose name or one of whose aliases equals one of `names` (case-insensitive). */
export function findDuplicates(names: string[], notes: NoteInfo[]): Duplicate[] {
  const wanted = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean));
  const found: Duplicate[] = [];
  for (const note of notes) {
    const hit = [note.basename, ...note.aliases].find((n) => wanted.has(n.trim().toLowerCase()));
    if (hit !== undefined) found.push({ note, matched: hit });
  }
  return found;
}

/** Obsidian allows `aliases` as list or single string. */
export function aliasesOf(fm: Record<string, unknown> | undefined): string[] {
  const raw = fm?.aliases;
  if (Array.isArray(raw)) return raw.filter((a): a is string => typeof a === "string");
  return typeof raw === "string" ? [raw] : [];
}
