import { Modal, Notice, Setting, type App } from "obsidian";
import { findCatalogDuplicate } from "../core/catalog";
import { catalogFieldNames, countUsage, moveValue, removeValue, renameValue, updateValue } from "../core/maintenance";
import { COLORS, type CatalogDef, type CatalogValue } from "../core/types";
import type VaultsmithPlugin from "../main";
import { colorClass } from "./color";
import { allFrontmatter, appendCatalogValue, writeCatalog } from "../vault/notes";
import { CreateValueModal } from "./CreateValueModal";

/** "Catalogs" section of the settings tab: edit values without touching JSON. */
export class CatalogEditor {
  private catalogId: string | undefined;

  constructor(private plugin: VaultsmithPlugin, private redraw: () => void) {}

  render(containerEl: HTMLElement): void {
    const config = this.plugin.config;
    new Setting(containerEl).setName("Catalogs").setHeading();
    if (!config) {
      containerEl.createEl("p", { text: 'No valid configuration. Run "Check configuration".' });
      return;
    }
    const ids = [...config.catalogs.keys()];
    if (!this.catalogId || !config.catalogs.has(this.catalogId)) this.catalogId = ids[0];
    if (!this.catalogId) return;

    new Setting(containerEl)
      .setName("Catalog")
      .setDesc("Order matters: it is the order in dropdowns and the order of the status bar arrows.")
      .addDropdown((d) => {
        for (const id of ids) d.addOption(id, config.catalogs.get(id)!.label);
        d.setValue(this.catalogId!).onChange((v) => {
          this.catalogId = v;
          this.redraw();
        });
      })
      .addButton((b) => b.setButtonText("Add value").onClick(() => this.add()));

    const catalog = config.catalogs.get(this.catalogId)!;
    const notes = allFrontmatter(this.plugin.app).map((n) => n.fm);
    catalog.values.forEach((value, i) => {
      const used = countUsage(config, notes, catalog.id, value.id);
      const s = new Setting(containerEl)
        .setName(value.label)
        .setDesc([value.id, value.aliases?.join(", "), `${used} note${used === 1 ? "" : "s"}`].filter(Boolean).join(" · "));
      if (value.color) s.nameEl.addClass("vaultsmith-colored", colorClass(value.color));
      s.addExtraButton((b) =>
        b.setIcon("arrow-up").setTooltip("Move up").setDisabled(i === 0).onClick(() => this.save(moveValue(catalog, value.id, -1))),
      )
        .addExtraButton((b) =>
          b
            .setIcon("arrow-down")
            .setTooltip("Move down")
            .setDisabled(i === catalog.values.length - 1)
            .onClick(() => this.save(moveValue(catalog, value.id, 1))),
        )
        .addExtraButton((b) =>
          b.setIcon("pencil").setTooltip("Edit label, aliases, description, color").onClick(() =>
            new EditValueModal(this.plugin.app, value, (patch) => this.save(updateValue(catalog, value.id, patch))).open(),
          ),
        )
        .addExtraButton((b) =>
          b.setIcon("replace").setTooltip("Rename ID in all notes").onClick(() => {
            const asDefault = this.defaultIn(catalog.id, value.id);
            if (asDefault.length) {
              new Notice(`"${value.id}" is the default in schema ${asDefault.join(", ")}. Change the default there first.`);
              return;
            }
            new RenameIdModal(this.plugin.app, catalog, value, used, (newId) => this.renameId(catalog, value.id, newId)).open();
          }),
        )
        .addExtraButton((b) =>
          b
            .setIcon("trash")
            .setTooltip(used ? `Used in ${used} notes. Rename the ID instead.` : "Delete")
            .setDisabled(used > 0)
            .onClick(() => {
              if (used > 0) return;
              const asDefault = this.defaultIn(catalog.id, value.id);
              if (asDefault.length) new Notice(`"${value.id}" is the default in schema ${asDefault.join(", ")}. Change the default there first.`);
              else void this.save(removeValue(catalog, value.id));
            }),
        );
    });
  }

  /** Schemas that use this value as a field default; renaming it would break them. */
  private defaultIn(catalogId: string, valueId: string): string[] {
    const schemas = [...(this.plugin.config?.schemas.values() ?? [])];
    return schemas
      .filter((s) =>
        (s.fields ?? []).some(
          (f) => f.catalog === catalogId && (Array.isArray(f.default) ? f.default.includes(valueId) : f.default === valueId),
        ),
      )
      .map((s) => s.id);
  }

  private async save(catalog: CatalogDef): Promise<void> {
    const path = this.plugin.config?.catalogPaths.get(catalog.id);
    if (!path) return;
    await writeCatalog(this.plugin.app, path, catalog);
    await this.plugin.reloadConfig();
    this.redraw();
  }

  private add(): void {
    const config = this.plugin.config;
    const catalog = this.catalogId ? config?.catalogs.get(this.catalogId) : undefined;
    const path = this.catalogId ? config?.catalogPaths.get(this.catalogId) : undefined;
    if (!catalog || !path) return;
    new CreateValueModal(
      this.plugin.app,
      catalog,
      "",
      (value) => appendCatalogValue(this.plugin.app, path, value),
      async (value) => {
        if (!value) return;
        await this.plugin.reloadConfig();
        this.redraw();
      },
    ).open();
  }

  /** Changes the id in the catalog, then in every note that uses it. */
  private async renameId(catalog: CatalogDef, oldId: string, newId: string): Promise<void> {
    const config = this.plugin.config;
    if (!config) return;
    const fields = catalogFieldNames(config, catalog.id);
    await this.save(updateValue(catalog, oldId, { id: newId }));
    let changed = 0;
    for (const { file, fm } of allFrontmatter(this.plugin.app)) {
      if (!renameValue({ ...fm }, fields, oldId, newId)) continue;
      await this.plugin.app.fileManager.processFrontMatter(file, (current: Record<string, unknown>) => {
        renameValue(current, fields, oldId, newId);
      });
      changed++;
    }
    new Notice(`Renamed "${oldId}" to "${newId}" in ${changed} note${changed === 1 ? "" : "s"}.`);
    this.redraw();
  }
}

class EditValueModal extends Modal {
  private patch: Partial<CatalogValue>;

  constructor(app: App, private value: CatalogValue, private onSave: (patch: Partial<CatalogValue>) => Promise<void>) {
    super(app);
    this.patch = { label: value.label, aliases: value.aliases ?? [], description: value.description ?? "", color: value.color };
  }

  onOpen(): void {
    this.titleEl.setText(`Edit "${this.value.label}"`);
    const { contentEl } = this;
    contentEl.createEl("p", { text: `ID: ${this.value.id} (stored in notes, rename it from the list)`, cls: "vaultsmith-info" });
    new Setting(contentEl).setName("Label").addText((t) => t.setValue(this.patch.label ?? "").onChange((v) => (this.patch.label = v)));
    new Setting(contentEl)
      .setName("Aliases")
      .setDesc("Comma-separated, e.g. the German name.")
      .addText((t) =>
        t.setValue((this.patch.aliases ?? []).join(", ")).onChange((v) => (this.patch.aliases = v.split(",").map((a) => a.trim()).filter(Boolean))),
      );
    new Setting(contentEl).setName("Description").setDesc("Shown as hint in the form.").addText((t) =>
      t.setValue(this.patch.description ?? "").onChange((v) => (this.patch.description = v)),
    );
    new Setting(contentEl).setName("Color").addDropdown((d) => {
      d.addOption("", "None");
      for (const c of COLORS) d.addOption(c, c);
      d.setValue(this.patch.color ?? "").onChange((v) => (this.patch.color = v || undefined));
    });
    const errorEl = contentEl.createDiv({ cls: "vaultsmith-error" });
    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText("Save")
          .setCta()
          .onClick(async () => {
            if (!this.patch.label?.trim()) return errorEl.setText("Label is required.");
            this.patch.label = this.patch.label.trim();
            await this.onSave(this.patch);
            this.close();
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class RenameIdModal extends Modal {
  private newId = "";

  constructor(
    app: App,
    private catalog: CatalogDef,
    private value: CatalogValue,
    private used: number,
    private onRename: (newId: string) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(`Rename ID "${this.value.id}"`);
    const { contentEl } = this;
    contentEl.createEl("p", {
      text: `Changes the ID in the catalog and in ${this.used} note${this.used === 1 ? "" : "s"}. This edits those files.`,
    });
    new Setting(contentEl).setName("New ID").addText((t) => t.setValue(this.value.id).onChange((v) => (this.newId = v.trim())));
    const errorEl = contentEl.createDiv({ cls: "vaultsmith-error" });
    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText("Rename")
          .setWarning()
          .onClick(async () => {
            if (!/^[a-z0-9]+(_[a-z0-9]+)*$/.test(this.newId)) return errorEl.setText("ID must be lowercase letters, digits and single underscores.");
            if (this.newId === this.value.id) return this.close();
            const dup = findCatalogDuplicate({ ...this.catalog, values: this.catalog.values.filter((v) => v.id !== this.value.id) }, [this.newId]);
            if (dup) return errorEl.setText(`"${this.newId}" is already used by "${dup.label}".`);
            this.close();
            await this.onRename(this.newId);
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
