import { PluginSettingTab, Setting, type App } from "obsidian";
import type VaultsmithPlugin from "./main";

export interface VaultsmithSettings {
  configFolder: string;
  templatesFolder: string;
  /** Type preselected in "New note". */
  lastSchema?: string;
}

export const DEFAULT_SETTINGS: VaultsmithSettings = {
  configFolder: "_Vaultsmith",
  templatesFolder: "Templates",
};

export class VaultsmithSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: VaultsmithPlugin) {
    super(app, plugin);
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
  }
}
