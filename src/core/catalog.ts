import type { CatalogDef, CatalogValue } from "./types";

const norm = (s: string) => s.trim().toLowerCase();
const terms = (v: CatalogValue) => [v.label, v.id, ...(v.aliases ?? [])];

/** Values matching `query` in label, id or alias. Prefix matches first, then catalog order. */
export function searchCatalog(catalog: CatalogDef, query: string): CatalogValue[] {
  const q = norm(query);
  if (!q) return [...catalog.values];
  const scored: { value: CatalogValue; score: number; index: number }[] = [];
  catalog.values.forEach((value, index) => {
    const t = terms(value).map(norm);
    const score = t.some((x) => x.startsWith(q)) ? 0 : t.some((x) => x.includes(q)) ? 1 : -1;
    if (score >= 0) scored.push({ value, score, index });
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((s) => s.value);
}

/** An existing value whose id, label or alias equals any of `candidates` (case-insensitive). */
export function findCatalogDuplicate(catalog: CatalogDef, candidates: string[]): CatalogValue | undefined {
  const wanted = new Set(candidates.map(norm).filter(Boolean));
  return catalog.values.find((v) => terms(v).some((t) => wanted.has(norm(t))));
}

/** Label for a stored id; unknown ids are shown as they are. */
export const labelOf = (catalog: CatalogDef | undefined, id: string) =>
  catalog?.values.find((v) => v.id === id)?.label ?? id;
