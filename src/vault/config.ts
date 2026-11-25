import { normalizePath, TFile, TFolder, type App } from "obsidian";
import type { RawFile } from "../core/types";

/** All .json files below a folder, subfolders included. */
function jsonFilesIn(app: App, folderPath: string): TFile[] {
  const folder = app.vault.getAbstractFileByPath(normalizePath(folderPath));
  if (!(folder instanceof TFolder)) return [];
  const files: TFile[] = [];
  const walk = (f: TFolder) => {
    for (const child of f.children) {
      if (child instanceof TFolder) walk(child);
      else if (child instanceof TFile && child.extension === "json") files.push(child);
    }
  };
  walk(folder);
  return files;
}

/** Reads every .json file below <folder>/Schemas and <folder>/Catalogs (subfolders included). */
export async function readConfigFiles(app: App, folder: string): Promise<{ schemaFiles: RawFile[]; catalogFiles: RawFile[] }> {
  const read = (files: TFile[]) =>
    Promise.all(files.map(async (f) => ({ path: f.path, text: await app.vault.cachedRead(f) })));
  return {
    schemaFiles: await read(jsonFilesIn(app, `${folder}/Schemas`)),
    catalogFiles: await read(jsonFilesIn(app, `${folder}/Catalogs`)),
  };
}

export const pathExists = (app: App, path: string) => app.vault.getAbstractFileByPath(normalizePath(path)) !== null;
