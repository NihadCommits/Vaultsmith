import { Notice, Plugin, normalizePath, type TAbstractFile } from "obsidian";
import { buildConfig } from "./core/validate";
import type { Config, Issue } from "./core/types";
import { DEFAULT_SETTINGS, VaultsmithSettingTab, type VaultsmithSettings } from "./settings";
import { IssuesModal } from "./ui/IssuesModal";
import { openNewNote } from "./ui/NoteModal";
import { pathExists, readConfigFiles } from "./vault/config";

export default class VaultsmithPlugin extends Plugin {
  settings: VaultsmithSettings = { ...DEFAULT_SETTINGS };
  /** Last valid configuration. Stays in use while the files on disk have errors. */
  config: Config | undefined;
  issues: Issue[] = [];
  private reloadTimer: number | undefined;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new VaultsmithSettingTab(this.app, this));

    this.addRibbonIcon("file-plus", "Vaultsmith: New note", () => openNewNote(this));
    this.addCommand({ id: "new-note", name: "New note", callback: () => openNewNote(this) });
    this.addCommand({
      id: "check-configuration",
      name: "Check configuration",
      callback: () => new IssuesModal(this.app, this.issues, this.config).open(),
    });

    // Registered after layout-ready so the initial vault scan doesn't fire a reload per file.
    this.app.workspace.onLayoutReady(async () => {
      await this.reloadConfig();
      const onChange = (file: TAbstractFile, oldPath?: string) => {
        if (this.inConfigFolder(file.path) || (oldPath !== undefined && this.inConfigFolder(oldPath))) this.scheduleReload();
      };
      this.registerEvent(this.app.vault.on("create", onChange));
      this.registerEvent(this.app.vault.on("modify", onChange));
      this.registerEvent(this.app.vault.on("delete", onChange));
      this.registerEvent(this.app.vault.on("rename", onChange));
    });
  }

  onunload(): void {
    window.clearTimeout(this.reloadTimer);
  }

  private inConfigFolder(path: string): boolean {
    return path.startsWith(`${normalizePath(this.settings.configFolder)}/`);
  }

  scheduleReload(): void {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => void this.reloadConfig(), 300);
  }

  async reloadConfig(): Promise<void> {
    const { schemaFiles, catalogFiles } = await readConfigFiles(this.app, this.settings.configFolder);
    const result = buildConfig(schemaFiles, catalogFiles, (path) => pathExists(this.app, path));
    this.issues = result.issues;
    if (result.config) this.config = result.config;
    const errors = result.issues.filter((i) => i.level === "error").length;
    if (errors > 0) new Notice(`Vaultsmith: ${errors} configuration error(s). Run "Check configuration" for details.`);
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<VaultsmithSettings> | null) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
