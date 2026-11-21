import { Notice, Plugin, TFile, normalizePath, type TAbstractFile } from "obsidian";
import { buildConfig } from "./core/validate";
import { stepStatus } from "./core/status";
import type { Config, Issue } from "./core/types";
import { DEFAULT_SETTINGS, VaultsmithSettingTab, type VaultsmithSettings } from "./settings";
import { IssuesModal } from "./ui/IssuesModal";
import { openEditNote, openNewNote } from "./ui/NoteModal";
import { StatusBar, StatusPickerModal } from "./ui/StatusBar";
import { pathExists, readConfigFiles } from "./vault/config";

export default class VaultsmithPlugin extends Plugin {
  settings: VaultsmithSettings = { ...DEFAULT_SETTINGS };
  /** Last valid configuration. Stays in use while the files on disk have errors. */
  config: Config | undefined;
  issues: Issue[] = [];
  private reloadTimer: number | undefined;
  private statusBar: StatusBar | undefined;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new VaultsmithSettingTab(this.app, this));

    this.addRibbonIcon("file-plus", "Vaultsmith: New note", () => openNewNote(this));
    this.addCommand({ id: "new-note", name: "New note", callback: () => openNewNote(this) });
    this.addCommand({
      id: "edit-properties",
      name: "Edit properties",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!(file instanceof TFile) || file.extension !== "md") return false;
        if (!checking) openEditNote(this, file);
        return true;
      },
    });
    this.addCommand({
      id: "status-next",
      name: "Status: next stage",
      checkCallback: (checking) => this.stepCommand(checking, 1),
    });
    this.addCommand({
      id: "status-previous",
      name: "Status: previous stage",
      checkCallback: (checking) => this.stepCommand(checking, -1),
    });
    this.addCommand({
      id: "status-set",
      name: "Status: set…",
      checkCallback: (checking) => {
        if (!this.statusBar?.current()) return false;
        if (!checking) this.pickStatus();
        return true;
      },
    });
    this.addCommand({
      id: "check-configuration",
      name: "Check configuration",
      callback: () => new IssuesModal(this.app, this.issues, this.config).open(),
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem((item) =>
          item
            .setTitle("Edit properties (Vaultsmith)")
            .setIcon("pencil")
            .onClick(() => openEditNote(this, file)),
        );
      }),
    );

    // Registered after layout-ready so the initial vault scan doesn't fire a reload per file.
    this.app.workspace.onLayoutReady(async () => {
      await this.reloadConfig();
      this.statusBar = new StatusBar(this);
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

  private stepCommand(checking: boolean, direction: 1 | -1): boolean {
    const cur = this.statusBar?.current();
    const target = cur ? stepStatus(cur.info, direction) : null;
    if (!cur || target === null) return false;
    if (!checking) void this.setStatus(cur.file, cur.info.field.name, target);
    return true;
  }

  pickStatus(): void {
    const cur = this.statusBar?.current();
    if (!cur) return;
    new StatusPickerModal(this.app, cur.info, (value) => void this.setStatus(cur.file, cur.info.field.name, value.id)).open();
  }

  async setStatus(file: TFile, field: string, value: string): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm[field] = value;
    });
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
    this.statusBar?.update();
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
