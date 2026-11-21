import { PluginSettingTab, Setting, type App } from "obsidian";
import type VaultsmithPlugin from "./main";

export interface VaultsmithSettings {
  configFolder: string;
}

export const DEFAULT_SETTINGS: VaultsmithSettings = {
  configFolder: "_Vaultsmith",
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
  }
}
