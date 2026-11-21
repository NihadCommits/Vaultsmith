import { normalizePath, type App, type TFile } from "obsidian";
import type { RawFile } from "../core/types";

/** Reads every .json file below <folder>/Schemas and <folder>/Catalogs (subfolders included). */
export async function readConfigFiles(app: App, folder: string): Promise<{ schemaFiles: RawFile[]; catalogFiles: RawFile[] }> {
  const base = normalizePath(folder);
  const pick = (sub: string) =>
    app.vault.getFiles().filter((f) => f.extension === "json" && f.path.startsWith(`${base}/${sub}/`));
  const read = (files: TFile[]) =>
    Promise.all(files.map(async (f) => ({ path: f.path, text: await app.vault.cachedRead(f) })));
  return { schemaFiles: await read(pick("Schemas")), catalogFiles: await read(pick("Catalogs")) };
}

export const pathExists = (app: App, path: string) => app.vault.getAbstractFileByPath(normalizePath(path)) !== null;
