import { PluginSettingTab, Setting, type App } from "obsidian";
import type VaultsmithPlugin from "./main";
import { CatalogEditor } from "./ui/CatalogEditor";

export interface VaultsmithSettings {
  configFolder: string;
  templatesFolder: string;
  /** Choice field shown in the status bar. */
  statusField: string;
  /** Type preselected in "New note". */
  lastSchema?: string;
}

export const DEFAULT_SETTINGS: VaultsmithSettings = {
  configFolder: "_Vaultsmith",
  templatesFolder: "Templates",
  statusField: "status",
};

export class VaultsmithSettingTab extends PluginSettingTab {
  private catalogs: CatalogEditor;

  constructor(app: App, private plugin: VaultsmithPlugin) {
    super(app, plugin);
    this.catalogs = new CatalogEditor(plugin, () => this.display());
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Config folder")
      .setDesc("Folder with Schemas/ and Catalogs/. Changes there are picked up automatically.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.configFolder)
          .setValue(this.plugin.settings.configFolder)
          .onChange(async (value) => {
            this.plugin.settings.configFolder = value.trim() || DEFAULT_SETTINGS.configFolder;
            await this.plugin.saveSettings();
            this.plugin.scheduleReload();
          }),
      );
    new Setting(containerEl)
      .setName("Templates folder")
      .setDesc('Markdown files offered in the "Template" dropdown.')
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.templatesFolder)
          .setValue(this.plugin.settings.templatesFolder)
          .onChange(async (value) => {
            this.plugin.settings.templatesFolder = value.trim() || DEFAULT_SETTINGS.templatesFolder;
            await this.plugin.saveSettings();
          }),
      );
    new Setting(containerEl)
      .setName("Status field")
      .setDesc("Choice field shown in the status bar, with arrows to step through its catalog.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.statusField)
          .setValue(this.plugin.settings.statusField)
          .onChange(async (value) => {
            this.plugin.settings.statusField = value.trim() || DEFAULT_SETTINGS.statusField;
            await this.plugin.saveSettings();
            this.plugin.scheduleReload();
          }),
      );
    this.catalogs.render(containerEl);
  }
}
