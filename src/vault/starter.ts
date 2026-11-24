import { normalizePath, type App } from "obsidian";
import starter from "virtual:starter";
import { ensureFolder } from "./notes";

/** Folder layout the starter types are written for. Optional at install time. */
export const RECOMMENDED_FOLDERS = [
  "10 Personal/Events",
  "10 Personal/People",
  "10 Personal/Stories",
  "20 Knowledge/01 - Concepts & Topics/01 - Topics",
  "20 Knowledge/01 - Concepts & Topics/02 - Concepts",
  "20 Knowledge/02 - Entities",
  "20 Knowledge/03 - Maps",
  "30 Projects",
  "40 Outputs",
  "90 Archive",
  "Attachments",
];

/**
 * Writes the bundled starter files into the vault. `_Vaultsmith/` maps to the configured
 * config folder. Existing files are never overwritten; existing folders are left alone.
 */
export async function installStarter(
  app: App,
  configFolder: string,
  withFolders: boolean,
): Promise<{ created: string[]; skipped: string[]; folders: number }> {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const [rel, content] of Object.entries(starter)) {
    const path = normalizePath(rel.startsWith("_Vaultsmith/") ? `${configFolder}/${rel.slice("_Vaultsmith/".length)}` : rel);
    if (app.vault.getAbstractFileByPath(path)) {
      skipped.push(path);
      continue;
    }
    const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    await ensureFolder(app, folder);
    await app.vault.create(path, content);
    created.push(path);
  }
  let folders = 0;
  if (withFolders) {
    for (const f of RECOMMENDED_FOLDERS) {
      if (app.vault.getAbstractFileByPath(f)) continue;
      await ensureFolder(app, f);
      folders++;
    }
  }
  return { created, skipped, folders };
}
