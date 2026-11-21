/** Splits a template into its YAML frontmatter text (if any) and body. */
export function splitFrontmatter(text: string): { yaml: string | null; body: string } {
  const normalized = text.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(normalized);
  if (!match) return { yaml: null, body: normalized };
  return { yaml: match[1], body: normalized.slice(match[0].length) };
}

/**
 * Replaces {{title}}, {{date}}, {{time}}, {{date:FORMAT}} and {{time:FORMAT}} like Obsidian's core Templates plugin.
 * `format` formats the current moment (Obsidian passes moment()).
 */
export function fillPlaceholders(body: string, title: string, format: (pattern: string) => string): string {
  return body.replace(/\{\{\s*(title|date|time)\s*(?::([^}]*))?\}\}/gi, (_, key: string, pattern?: string) => {
    const k = key.toLowerCase();
    if (k === "title") return title;
    return format(pattern?.trim() || (k === "date" ? "YYYY-MM-DD" : "HH:mm"));
  });
}

/** Schema values win; keys only the template has are kept after them. */
export function mergeFrontmatter(schemaFm: Record<string, unknown>, templateFm: Record<string, unknown> | null): Record<string, unknown> {
  const merged = { ...schemaFm };
  for (const [k, v] of Object.entries(templateFm ?? {})) if (!(k in merged)) merged[k] = v;
  return merged;
}
