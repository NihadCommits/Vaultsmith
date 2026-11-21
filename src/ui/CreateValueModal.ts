import { Modal, Setting, type App } from "obsidian";
import { findCatalogDuplicate } from "../core/catalog";
import { slugify } from "../core/filename";
import type { CatalogDef, CatalogValue } from "../core/types";

/** Asks for label, id and aliases of a new catalog value. Resolves with null on cancel. */
export class CreateValueModal extends Modal {
  private label = "";
  private id = "";
  private idEdited = false;
  private aliases: string;
  private done = false;

  constructor(
    app: App,
    private catalog: CatalogDef,
    typed: string,
    private save: (value: CatalogValue) => Promise<void>,
    private resolve: (value: CatalogValue | null) => void,
  ) {
    super(app);
    this.aliases = typed.trim();
  }

  onOpen(): void {
    this.titleEl.setText(`New value in "${this.catalog.label}"`);
    const { contentEl } = this;
    let idInput: HTMLInputElement | undefined;

    new Setting(contentEl).setName("Label").setDesc("English, as shown in the form.").addText((t) => {
      t.onChange((v) => {
        this.label = v;
        if (!this.idEdited && idInput) idInput.value = this.id = slugify(v);
      });
      window.setTimeout(() => t.inputEl.focus(), 0);
    });
    new Setting(contentEl).setName("ID").setDesc("Stored in your notes. Lowercase, snake_case.").addText((t) => {
      idInput = t.inputEl;
      t.onChange((v) => {
        this.id = v;
        this.idEdited = true;
      });
    });
    new Setting(contentEl)
      .setName("Aliases")
      .setDesc("Comma-separated, e.g. the German name. Found by search.")
      .addText((t) => t.setValue(this.aliases).onChange((v) => (this.aliases = v)));

    const errorEl = contentEl.createDiv({ cls: "vaultsmith-error" });
    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText("Create")
          .setCta()
          .onClick(async () => {
            const value: CatalogValue = { id: this.id.trim(), label: this.label.trim() };
            const aliases = this.aliases.split(",").map((a) => a.trim()).filter(Boolean);
            if (aliases.length) value.aliases = aliases;
            const problem = !value.label
              ? "Label is required."
              : !/^[a-z0-9]+(_[a-z0-9]+)*$/.test(value.id)
                ? "ID must be lowercase letters, digits and single underscores."
                : (() => {
                    const dup = findCatalogDuplicate(this.catalog, [value.id, value.label, ...aliases]);
                    return dup ? `Already exists as "${dup.label}" (${dup.id}).` : null;
                  })();
            if (problem) return errorEl.setText(problem);
            try {
              await this.save(value);
            } catch (e) {
              return errorEl.setText(`Could not save: ${(e as Error).message}`);
            }
            this.done = true;
            this.resolve(value);
            this.close();
          }),
      );
  }

  onClose(): void {
    if (!this.done) this.resolve(null);
    this.contentEl.empty();
  }
}
