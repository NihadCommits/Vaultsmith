import { normalizePath, TFile, TFolder, type App } from "obsidian";
import type { NoteInfo } from "../core/notes";
import { aliasesOf } from "../core/notes";
import { detectSchema } from "../core/resolve";
import type { CatalogValue, Config } from "../core/types";

/** All notes with aliases and detected type, straight from Obsidian's metadata cache (no own index). */
export function listNotes(app: App, config: Config): NoteInfo[] {
  return app.vault.getMarkdownFiles().map((f) => {
    const fm = app.metadataCache.getFileCache(f)?.frontmatter;
    return { path: f.path, basename: f.basename, aliases: aliasesOf(fm), schemaId: detectSchema(config, fm)?.schema.id };
  });
}

/** Shortest link text that still points to this note unambiguously. */
export function linkTextFor(app: App, path: string): string {
  const file = app.vault.getAbstractFileByPath(path);
  return file instanceof TFile ? app.metadataCache.fileToLinktext(file, "") : path.replace(/\.md$/, "");
}

/** All folder paths, "" = vault root. */
export function listFolders(app: App): string[] {
  return app.vault
    .getAllLoadedFiles()
    .filter((f): f is TFolder => f instanceof TFolder)
    .map((f) => (f.isRoot() ? "" : f.path))
    .sort((a, b) => a.localeCompare(b));
}

export function listTemplates(app: App, folder: string): string[] {
  const base = normalizePath(folder);
  return app.vault
    .getMarkdownFiles()
    .filter((f) => f.path.startsWith(`${base}/`))
    .map((f) => f.path)
    .sort((a, b) => a.localeCompare(b));
}

/** Creates the folder and any missing parents. */
export async function ensureFolder(app: App, folder: string): Promise<void> {
  if (!folder) return;
  let path = "";
  for (const part of normalizePath(folder).split("/")) {
    path = path ? `${path}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
  }
}

export async function readTemplate(app: App, path: string): Promise<string | null> {
  const file = app.vault.getAbstractFileByPath(normalizePath(path));
  return file instanceof TFile ? app.vault.read(file) : null;
}

/** Appends a value to a catalog JSON file, keeping the rest of the file as is. */
export async function appendCatalogValue(app: App, catalogPath: string, value: CatalogValue): Promise<void> {
  const file = app.vault.getAbstractFileByPath(catalogPath);
  if (!(file instanceof TFile)) throw new Error(`${catalogPath} not found`);
  await app.vault.process(file, (text) => {
    const data = JSON.parse(text) as { values: CatalogValue[] };
    data.values.push(value);
    return JSON.stringify(data, null, 2) + "\n";
  });
}
