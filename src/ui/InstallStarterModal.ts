import { Modal, Notice, Setting } from "obsidian";
import type VaultsmithPlugin from "../main";
import { RECOMMENDED_FOLDERS, installStarter } from "../vault/starter";

/** Asks whether to add the recommended folders, then installs the starter config. */
export class InstallStarterModal extends Modal {
  private withFolders = false;

  constructor(private plugin: VaultsmithPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText("Install starter config");
    const { contentEl } = this;
    contentEl.createEl("p", {
      text: `Adds example types and catalogs to "${this.plugin.settings.configFolder}/", templates to "Templates/" and "Worklist.base". Existing files are never overwritten.`,
    });
    contentEl.createEl("p", {
      text: "The example types save notes into the folders below. Folders are also created automatically with the first note. If you use your own folder structure, skip them and change \"defaultFolder\" in the schemas instead.",
      cls: "vaultsmith-info",
    });
    new Setting(contentEl)
      .setName("Also create the recommended folders")
      .addToggle((t) => t.setValue(this.withFolders).onChange((v) => (this.withFolders = v)));
    const list = contentEl.createEl("ul", { cls: "vaultsmith-info" });
    for (const f of RECOMMENDED_FOLDERS) list.createEl("li", { text: f });

    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText("Install")
          .setCta()
          .onClick(async () => {
            this.close();
            const { created, skipped, folders } = await installStarter(this.app, this.plugin.settings.configFolder, this.withFolders);
            await this.plugin.reloadConfig();
            const parts = [`created ${created.length} file${created.length === 1 ? "" : "s"}`];
            if (skipped.length) parts.push(`kept ${skipped.length} existing`);
            if (this.withFolders) parts.push(`added ${folders} folder${folders === 1 ? "" : "s"}`);
            new Notice(`Vaultsmith: ${parts.join(", ")}.`);
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
