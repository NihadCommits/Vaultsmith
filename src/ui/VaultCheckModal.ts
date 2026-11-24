import { Modal, normalizePath, type TFile } from "obsidian";
import { lintNote } from "../core/maintenance";
import type { Config } from "../core/types";
import type VaultsmithPlugin from "../main";
import { allFrontmatter } from "../vault/notes";
import { openEditNote } from "./NoteModal";

/** Lists notes that don't match the configuration, with a button to fix each one. */
export class VaultCheckModal extends Modal {
  constructor(private plugin: VaultsmithPlugin, private config: Config) {
    super(plugin.app);
  }

  onOpen(): void {
    this.modalEl.addClass("vaultsmith-modal");
    this.titleEl.setText("Vault check");
    const { settings } = this.plugin;
    const skip = [settings.templatesFolder, settings.configFolder].map((f) => `${normalizePath(f)}/`);
    const typed = [...this.config.schemas.values()].map((s) => s.defaultFolder).filter((f): f is string => !!f).map((f) => `${normalizePath(f)}/`);

    const results: { file: TFile; problems: string[] }[] = [];
    for (const { file, fm } of allFrontmatter(this.app)) {
      if (skip.some((p) => file.path.startsWith(p))) continue;
      const problems = lintNote(this.config, fm, typed.some((p) => file.path.startsWith(p)));
      if (problems.length) results.push({ file, problems });
    }
    results.sort((a, b) => a.file.path.localeCompare(b.file.path));

    const { contentEl } = this;
    if (results.length === 0) {
      contentEl.createEl("p", { text: "All notes match the configuration." });
      return;
    }
    contentEl.createEl("p", {
      text: `${results.length} note${results.length === 1 ? "" : "s"} with problems. Notes without type are only listed inside the default folders of your types.`,
    });
    const list = contentEl.createEl("ul", { cls: "vaultsmith-check" });
    for (const { file, problems } of results) {
      const item = list.createEl("li");
      const open = item.createEl("a", { text: file.basename, href: "#" });
      open.addEventListener("click", (e) => {
        e.preventDefault();
        void this.app.workspace.getLeaf(false).openFile(file);
        this.close();
      });
      const fix = item.createEl("button", { text: "Edit properties", cls: "vaultsmith-check-fix" });
      fix.addEventListener("click", () => {
        this.close();
        openEditNote(this.plugin, file);
      });
      const sub = item.createEl("ul");
      for (const p of problems) sub.createEl("li", { text: p });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
