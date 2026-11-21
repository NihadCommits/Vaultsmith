import { Modal, Notice, Setting, normalizePath, parseYaml, stringifyYaml, type TextComponent } from "obsidian";
import { sanitizeTitle } from "../core/filename";
import { buildFrontmatter, defaultValues, missingRequired } from "../core/frontmatter";
import { findDuplicates, type Duplicate, type NoteInfo } from "../core/notes";
import { chainOf, fieldsOf, folderOf, templateOf } from "../core/resolve";
import { fillPlaceholders, mergeFrontmatter, splitFrontmatter } from "../core/template";
import type { CatalogValue, Config, FieldDef } from "../core/types";
import type VaultsmithPlugin from "../main";
import { appendCatalogValue, ensureFolder, listFolders, listNotes, listTemplates, readTemplate } from "../vault/notes";
import { CreateValueModal } from "./CreateValueModal";
import { renderField, type FieldContext } from "./fields";

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

  private infoEl!: HTMLElement;
  private formEl!: HTMLElement;
  private yamlEl: HTMLElement | null = null;
  private errorEl!: HTMLElement;

  constructor(private plugin: VaultsmithPlugin, private config: Config) {
    super(plugin.app);
  }

  private get schemaId(): string | undefined {
    return this.path[this.path.length - 1];
  }

  onOpen(): void {
    this.modalEl.addClass("vaultsmith-modal");
    this.titleEl.setText("New note");
    this.notes = listNotes(this.app);

    const last = this.plugin.settings.lastSchema;
    if (last && this.config.schemas.has(last)) this.path = chainOf(this.config, last).slice(1).map((s) => s.id);
    this.applySchema();

    let titleInput: TextComponent | undefined;
    new Setting(this.contentEl).setName("Title").addText((t) => {
      titleInput = t;
      t.setPlaceholder("e.g. The Starry Night (1889)").onChange((v) => {
        this.title = v;
        this.renderInfo();
        this.renderYaml();
      });
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") void this.create();
      });
    });
    this.infoEl = this.contentEl.createDiv({ cls: "vaultsmith-info" });
    this.formEl = this.contentEl.createDiv();
    this.errorEl = this.contentEl.createDiv({ cls: "vaultsmith-error" });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) => b.setButtonText("Create note").setCta().onClick(() => void this.create()));

    this.render();
    window.setTimeout(() => titleInput?.inputEl.focus(), 0);
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
    this.renderLocation();
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
        d.addOption("", level === 0 ? "Choose…" : parent.abstract ? "Choose…" : "—");
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

    const templates = listTemplates(this.app, this.plugin.settings.templatesFolder);
    new Setting(this.formEl).setName("Template").addDropdown((d) => {
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
        else this.renderYaml();
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

  /** File name, aliases and frontmatter as they would be created. */
  private draft() {
    const { fileName, changed } = sanitizeTitle(this.title);
    const values = { ...this.values };
    const aliases = Array.isArray(values.aliases) ? [...(values.aliases as string[])] : [];
    if (changed && this.title.trim() && !aliases.includes(this.title.trim())) aliases.push(this.title.trim());
    values.aliases = aliases;
    const id = this.schemaId;
    const fm = id ? buildFrontmatter(this.config, id, values) : {};
    return { fileName, aliases, fm };
  }

  private duplicates(): Duplicate[] {
    const { fileName, aliases } = this.draft();
    if (!fileName) return [];
    return findDuplicates([fileName, this.title, ...aliases], this.notes);
  }

  private renderInfo(): void {
    this.infoEl.empty();
    const { fileName } = this.draft();
    if (fileName && fileName !== this.title.trim()) this.infoEl.createDiv({ text: `File name: ${fileName}.md (original title is kept as alias)` });
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
  }

  private renderYaml(): void {
    if (this.yamlEl) this.yamlEl.setText(stringifyYaml(this.draft().fm));
  }

  private async create(): Promise<void> {
    if (this.busy) return;
    this.errorEl.empty();
    const fail = (msg: string) => {
      this.errorEl.setText(msg);
    };
    const id = this.schemaId;
    const schema = id ? this.config.schemas.get(id) : undefined;
    const { fileName, fm } = this.draft();
    if (!fileName) return fail("Enter a title.");
    if (!id || !schema) return fail("Choose a type.");
    if (schema.abstract) return fail(`Choose a subtype of ${schema.label}.`);
    const missing = missingRequired(this.config, id, this.values);
    if (missing.length) return fail(`Required: ${missing.map((f) => f.label).join(", ")}.`);
    if (this.duplicates().length) return fail("A note with this name or alias already exists. Change the title or open the existing note.");

    let body = "";
    let templateFm: Record<string, unknown> | null = null;
    if (this.template) {
      const text = await readTemplate(this.app, this.template);
      if (text === null) return fail(`Template not found: ${this.template}`);
      const split = splitFrontmatter(text);
      body = fillPlaceholders(split.body, fileName, (p) => window.moment().format(p));
      try {
        templateFm = split.yaml ? ((parseYaml(split.yaml) as Record<string, unknown> | null) ?? null) : null;
      } catch (e) {
        return fail(`Template frontmatter is not valid YAML: ${(e as Error).message}`);
      }
    }

    const folder = this.folder ? normalizePath(this.folder) : "";
    const path = normalizePath(folder ? `${folder}/${fileName}.md` : `${fileName}.md`);
    const content = `---\n${stringifyYaml(mergeFrontmatter(fm, templateFm))}---\n${body}`;

    this.busy = true;
    try {
      await ensureFolder(this.app, folder);
      const file = await this.app.vault.create(path, content);
      this.plugin.settings.lastSchema = id;
      await this.plugin.saveSettings();
      this.close();
      await this.app.workspace.getLeaf(false).openFile(file);
    } catch (e) {
      fail(`Could not create the note: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }
}

export function openNewNote(plugin: VaultsmithPlugin): void {
  if (!plugin.config) {
    new Notice('Vaultsmith: no valid configuration. Run "Check configuration".');
    return;
  }
  new NoteModal(plugin, plugin.config).open();
}
