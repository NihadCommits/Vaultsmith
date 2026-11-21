import { Modal, Notice, Setting, TFile, normalizePath, parseYaml, stringifyYaml, type TextComponent } from "obsidian";
import { aliasesAfterRename, removedKeys, valuesFromFrontmatter } from "../core/edit";
import { sanitizeTitle } from "../core/filename";
import { buildFrontmatter, defaultValues, missingRequired } from "../core/frontmatter";
import { findDuplicates, type Duplicate, type NoteInfo } from "../core/notes";
import { chainOf, detectSchema, fieldsOf, folderOf, templateOf, type Detection } from "../core/resolve";
import { fillPlaceholders, mergeFrontmatter, splitFrontmatter } from "../core/template";
import type { CatalogValue, Config, FieldDef } from "../core/types";
import type VaultsmithPlugin from "../main";
import { appendCatalogValue, ensureFolder, listFolders, listNotes, listTemplates, readTemplate } from "../vault/notes";
import { CreateValueModal } from "./CreateValueModal";
import { renderField, type FieldContext } from "./fields";

/** Edit mode: what the note looked like when the dialog opened. */
interface EditState {
  file: TFile;
  fm: Record<string, unknown>;
  detection: Detection | null;
  folder: string;
  bodyEmpty: boolean;
}

/** "New note" and "Edit properties" share this dialog; `file` switches to edit mode. */
export class NoteModal extends Modal {
  private title = "";
  /** Chosen schema ids below the root, one per level. */
  private path: string[] = [];
  private values: Record<string, unknown> = {};
  private folder = "";
  private folderManual = false;
  private template = "";
  private templateManual = false;
  private showMore = false;
  private showYaml = false;
  private notes: NoteInfo[] = [];
  private busy = false;
  private edit: EditState | null = null;
  private moveToDefault = false;
  private keepOldTitle = true;

  private infoEl!: HTMLElement;
  private formEl!: HTMLElement;
  private yamlEl: HTMLElement | null = null;
  private errorEl!: HTMLElement;

  constructor(private plugin: VaultsmithPlugin, private config: Config, private file?: TFile) {
    super(plugin.app);
  }

  private get schemaId(): string | undefined {
    return this.path[this.path.length - 1];
  }

  async onOpen(): Promise<void> {
    this.modalEl.addClass("vaultsmith-modal");
    this.titleEl.setText(this.file ? "Edit properties" : "New note");
    this.notes = listNotes(this.app).filter((n) => n.path !== this.file?.path);

    if (this.file) {
      const fm = { ...(this.app.metadataCache.getFileCache(this.file)?.frontmatter ?? {}) } as Record<string, unknown>;
      const detection = detectSchema(this.config, fm);
      const text = await this.app.vault.read(this.file);
      this.edit = {
        file: this.file,
        fm,
        detection,
        folder: this.file.parent && !this.file.parent.isRoot() ? this.file.parent.path : "",
        bodyEmpty: splitFrontmatter(text).body.trim() === "",
      };
      this.title = this.file.basename;
      if (detection) this.path = chainOf(this.config, detection.schema.id).slice(1).map((s) => s.id);
      this.values = valuesFromFrontmatter(this.config, detection?.schema.id, fm);
      // Untyped notes, or notes still in their type's default folder, follow the type by default.
      const oldDefault = detection ? folderOf(this.config, detection.schema.id) : undefined;
      this.moveToDefault = !detection || oldDefault === this.edit.folder;
    } else {
      const last = this.plugin.settings.lastSchema;
      if (last && this.config.schemas.has(last)) this.path = chainOf(this.config, last).slice(1).map((s) => s.id);
    }
    this.applySchema();

    let titleInput: TextComponent | undefined;
    new Setting(this.contentEl).setName("Title").addText((t) => {
      titleInput = t;
      t.setPlaceholder("e.g. The Starry Night (1889)")
        .setValue(this.title)
        .onChange((v) => {
          this.title = v;
          this.renderInfo();
          this.renderYaml();
        });
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") void this.submit();
      });
    });
    this.infoEl = this.contentEl.createDiv({ cls: "vaultsmith-info" });
    this.formEl = this.contentEl.createDiv();
    this.errorEl = this.contentEl.createDiv({ cls: "vaultsmith-error" });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) => b.setButtonText(this.file ? "Save" : "Create note").setCta().onClick(() => void this.submit()));

    this.render();
    if (!this.file) window.setTimeout(() => titleInput?.inputEl.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /** After a type change: fill defaults, let folder/template follow the type unless set by hand. */
  private applySchema(): void {
    const id = this.schemaId;
    if (!id) return;
    for (const [k, v] of Object.entries(defaultValues(this.config, id))) if (this.values[k] === undefined) this.values[k] = v;
    if (!this.folderManual) this.folder = folderOf(this.config, id) ?? "";
    if (!this.templateManual) this.template = templateOf(this.config, id) ?? "";
  }

  private render(focusField?: string): void {
    this.formEl.empty();
    this.renderType();
    if (this.edit) this.renderEditLocation();
    else this.renderLocation();
    this.renderFields();
    this.renderInfo();
    if (focusField) this.formEl.querySelector<HTMLInputElement>(`input[data-field="${focusField}"]`)?.focus();
  }

  private renderType(): void {
    const setting = new Setting(this.formEl).setName("Type");
    setting.settingEl.addClass("vaultsmith-type");
    let parent = this.config.root;
    for (let level = 0; ; level++) {
      const options = this.config.children.get(parent.id) ?? [];
      if (options.length === 0) break;
      const chosen = this.path[level];
      setting.addDropdown((d) => {
        d.addOption("", level === 0 || parent.abstract ? "Choose…" : "—");
        for (const s of options) d.addOption(s.id, s.label);
        d.setValue(chosen ?? "");
        d.onChange((v) => {
          this.path = this.path.slice(0, level);
          if (v) this.path.push(v);
          this.applySchema();
          this.render();
        });
      });
      const next = chosen ? this.config.schemas.get(chosen) : undefined;
      if (!next) break;
      parent = next;
    }
  }

  private renderLocation(): void {
    const folders = listFolders(this.app);
    new Setting(this.formEl).setName("Save to").addDropdown((d) => {
      for (const f of folders) d.addOption(f, f || "(vault root)");
      if (!folders.includes(this.folder)) d.addOption(this.folder, `${this.folder} (new)`);
      d.setValue(this.folder).onChange((v) => {
        this.folder = v;
        this.folderManual = true;
      });
    });
    this.renderTemplateDropdown();
  }

  private renderEditLocation(): void {
    const edit = this.edit!;
    const target = this.schemaId ? folderOf(this.config, this.schemaId) : undefined;
    if (target !== undefined && target !== edit.folder) {
      new Setting(this.formEl)
        .setName("Move to default folder")
        .setDesc(`${edit.folder || "(vault root)"} → ${target}`)
        .addToggle((t) =>
          t.setValue(this.moveToDefault).onChange((v) => (this.moveToDefault = v)),
        );
    }
    if (edit.bodyEmpty) this.renderTemplateDropdown("The note is empty, so the template body is inserted.");
  }

  private renderTemplateDropdown(desc?: string): void {
    const templates = listTemplates(this.app, this.plugin.settings.templatesFolder);
    const setting = new Setting(this.formEl).setName("Template");
    if (desc) setting.setDesc(desc);
    setting.addDropdown((d) => {
      d.addOption("", "None");
      for (const t of templates) d.addOption(t, t);
      if (this.template && !templates.includes(this.template)) d.addOption(this.template, `${this.template} (missing)`);
      d.setValue(this.template).onChange((v) => {
        this.template = v;
        this.templateManual = true;
      });
    });
  }

  private renderFields(): void {
    const id = this.schemaId;
    if (!id) return;
    const own = new Set((this.config.schemas.get(id)?.fields ?? []).map((f) => f.name));
    const fields = fieldsOf(this.config, id);
    const visible = fields.filter((f) => f.required || own.has(f.name) || f.name === "aliases");
    const more = fields.filter((f) => !visible.includes(f));

    const ctx = this.fieldContext();
    for (const f of visible) renderField(this.formEl, f, ctx);

    if (more.length) {
      this.toggle(`More properties (${more.length})`, this.showMore, () => (this.showMore = !this.showMore));
      if (this.showMore) for (const f of more) renderField(this.formEl, f, ctx);
    }
    this.toggle("YAML preview", this.showYaml, () => (this.showYaml = !this.showYaml));
    this.yamlEl = this.showYaml ? this.formEl.createEl("pre", { cls: "vaultsmith-yaml" }) : null;
    this.renderYaml();
  }

  private toggle(text: string, open: boolean, flip: () => void): void {
    const el = this.formEl.createDiv({ cls: "vaultsmith-toggle", text: `${open ? "▾" : "▸"} ${text}` });
    el.addEventListener("click", () => {
      flip();
      this.render();
    });
  }

  private fieldContext(): FieldContext {
    return {
      app: this.app,
      catalog: (id) => (id === undefined ? undefined : this.config.catalogs.get(id)),
      get: (name) => this.values[name],
      set: (name, value, rerender) => {
        this.values[name] = value;
        if (rerender) this.render(name);
        else {
          this.renderYaml();
          this.renderInfo();
        }
      },
      refresh: () => {
        if (this.contentEl.isConnected) this.render();
      },
      createValue: (field, typed) => this.createValue(field, typed),
    };
  }

  private createValue(field: FieldDef, typed: string): Promise<CatalogValue | null> {
    const catalog = field.catalog === undefined ? undefined : this.config.catalogs.get(field.catalog);
    const catalogPath = field.catalog === undefined ? undefined : this.config.catalogPaths.get(field.catalog);
    if (!catalog || !catalogPath) return Promise.resolve(null);
    return new Promise((resolve) => {
      new CreateValueModal(
        this.app,
        catalog,
        typed,
        async (value) => {
          await appendCatalogValue(this.app, catalogPath, value);
          catalog.values.push(value); // usable right away; the file watcher reloads the rest
        },
        resolve,
      ).open();
    });
  }

  private renamed(fileName: string): boolean {
    return !!this.edit && fileName !== "" && fileName !== this.edit.file.basename;
  }

  /** File name, aliases and frontmatter as they would be written. */
  private draft() {
    const { fileName, changed } = sanitizeTitle(this.title);
    const values = { ...this.values };
    let aliases = Array.isArray(values.aliases) ? (values.aliases as unknown[]).map(String) : [];
    if (changed && this.title.trim() && !aliases.includes(this.title.trim())) aliases.push(this.title.trim());
    if (this.edit && this.renamed(fileName)) aliases = aliasesAfterRename(aliases, this.edit.file.basename, fileName, this.keepOldTitle);
    values.aliases = aliases;
    const id = this.schemaId;
    const fm = id ? buildFrontmatter(this.config, id, values) : {};
    return { fileName, aliases, fm };
  }

  private duplicates(): Duplicate[] {
    const { fileName, aliases } = this.draft();
    if (!fileName) return [];
    const names = this.edit ? [fileName, ...(this.renamed(fileName) ? [this.title] : [])] : [fileName, this.title, ...aliases];
    return findDuplicates(names, this.notes);
  }

  private renderInfo(): void {
    this.infoEl.empty();
    const { fileName, fm } = this.draft();
    const edit = this.edit;
    if (edit?.detection?.unknown) {
      const { field, value } = edit.detection.unknown;
      this.infoEl.createDiv({ cls: "vaultsmith-warning", text: `Unknown ${field} "${String(value)}". Pick a type below.` });
    }
    if (fileName && fileName !== this.title.trim()) this.infoEl.createDiv({ text: `File name: ${fileName}.md (original title is kept as alias)` });
    if (edit && this.renamed(fileName)) {
      const row = this.infoEl.createEl("label", { cls: "vaultsmith-rename" });
      const box = row.createEl("input", { type: "checkbox" });
      box.checked = this.keepOldTitle;
      box.addEventListener("change", () => {
        this.keepOldTitle = box.checked;
        this.renderYaml();
      });
      row.appendText(` Rename to "${fileName}" and keep "${edit.file.basename}" as alias`);
    }
    for (const dup of this.duplicates()) {
      const row = this.infoEl.createDiv({ cls: "vaultsmith-warning" });
      row.appendText(`Already exists: ${dup.note.basename}${dup.matched !== dup.note.basename ? ` (alias "${dup.matched}")` : ""} `);
      const open = row.createEl("a", { text: "Open", href: "#" });
      open.addEventListener("click", (e) => {
        e.preventDefault();
        void this.app.workspace.openLinkText(dup.note.path, "");
        this.close();
      });
    }
    if (edit && this.schemaId) {
      const removed = removedKeys(this.config, edit.fm, fm);
      if (removed.length) this.infoEl.createDiv({ cls: "vaultsmith-removed", text: `Will be removed: ${removed.join(", ")}` });
    }
  }

  private renderYaml(): void {
    if (this.yamlEl) this.yamlEl.setText(stringifyYaml(this.draft().fm));
  }

  /** Checks shared by create and save. Returns an error message or null. */
  private problem(): string | null {
    const id = this.schemaId;
    const schema = id ? this.config.schemas.get(id) : undefined;
    if (!this.draft().fileName) return "Enter a title.";
    if (!id || !schema) return "Choose a type.";
    if (schema.abstract) return `Choose a subtype of ${schema.label}.`;
    const missing = missingRequired(this.config, id, this.values);
    if (missing.length) return `Required: ${missing.map((f) => f.label).join(", ")}.`;
    if (this.duplicates().length) return "A note with this name or alias already exists. Change the title or open the existing note.";
    return null;
  }

  /** Template body (placeholders filled) and frontmatter; error message as string. */
  private async loadTemplate(title: string): Promise<{ body: string; fm: Record<string, unknown> | null } | string> {
    if (!this.template) return { body: "", fm: null };
    const text = await readTemplate(this.app, this.template);
    if (text === null) return `Template not found: ${this.template}`;
    const split = splitFrontmatter(text);
    try {
      const fm = split.yaml ? ((parseYaml(split.yaml) as Record<string, unknown> | null) ?? null) : null;
      return { body: fillPlaceholders(split.body, title, (p) => window.moment().format(p)), fm };
    } catch (e) {
      return `Template frontmatter is not valid YAML: ${(e as Error).message}`;
    }
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    this.errorEl.empty();
    const problem = this.problem();
    if (problem) return void this.errorEl.setText(problem);
    this.busy = true;
    try {
      await (this.edit ? this.save(this.edit) : this.create());
    } catch (e) {
      this.errorEl.setText(`Could not ${this.edit ? "save" : "create"} the note: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  private async create(): Promise<void> {
    const { fileName, fm } = this.draft();
    const template = await this.loadTemplate(fileName);
    if (typeof template === "string") return void this.errorEl.setText(template);

    const folder = this.folder ? normalizePath(this.folder) : "";
    const path = normalizePath(folder ? `${folder}/${fileName}.md` : `${fileName}.md`);
    const content = `---\n${stringifyYaml(mergeFrontmatter(fm, template.fm))}---\n${template.body}`;

    await ensureFolder(this.app, folder);
    const file = await this.app.vault.create(path, content);
    this.plugin.settings.lastSchema = this.schemaId;
    await this.plugin.saveSettings();
    this.close();
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  private async save(edit: EditState): Promise<void> {
    const { fileName, fm } = this.draft();
    const template = edit.bodyEmpty ? await this.loadTemplate(fileName) : { body: "", fm: null };
    if (typeof template === "string") return void this.errorEl.setText(template);

    const removed = removedKeys(this.config, edit.fm, fm);
    await this.app.fileManager.processFrontMatter(edit.file, (current: Record<string, unknown>) => {
      for (const key of removed) delete current[key];
      Object.assign(current, fm);
      for (const [k, v] of Object.entries(template.fm ?? {})) if (!(k in current)) current[k] = v;
    });
    if (template.body) await this.app.vault.process(edit.file, (text) => `${text.replace(/\s*$/, "\n")}${template.body}`);

    const target = this.schemaId ? folderOf(this.config, this.schemaId) : undefined;
    const folder = this.moveToDefault && target !== undefined ? normalizePath(target) : edit.folder;
    const path = normalizePath(folder ? `${folder}/${fileName}.md` : `${fileName}.md`);
    if (path !== edit.file.path) {
      await ensureFolder(this.app, folder);
      await this.app.fileManager.renameFile(edit.file, path);
    }
    this.close();
    new Notice(`Saved ${fileName}`);
  }
}

export function openNewNote(plugin: VaultsmithPlugin): void {
  if (!plugin.config) {
    new Notice('Vaultsmith: no valid configuration. Run "Check configuration".');
    return;
  }
  new NoteModal(plugin, plugin.config).open();
}

export function openEditNote(plugin: VaultsmithPlugin, file: TFile): void {
  if (!plugin.config) {
    new Notice('Vaultsmith: no valid configuration. Run "Check configuration".');
    return;
  }
  new NoteModal(plugin, plugin.config, file).open();
}
