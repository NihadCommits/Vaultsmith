/** Characters that are invalid in file names on some OS (Windows/Android) or break wikilinks. */
const FORBIDDEN = /[\\/:*?"<>|#^[\]]/g;

/**
 * Turns a title into a safe file name (without .md). `changed` tells the caller
 * to keep the original title as an alias.
 */
export function sanitizeTitle(title: string): { fileName: string; changed: boolean } {
  const trimmed = title.trim();
  const fileName = trimmed
    .replace(FORBIDDEN, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s-]+/, "") // a leading dot would hide the file
    .replace(/[.\s]+$/, ""); // Windows drops trailing dots and spaces
  return { fileName, changed: fileName !== trimmed };
}

/** Catalog value id from a label: lowercase snake_case ASCII, German umlauts spelled out. */
export function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
