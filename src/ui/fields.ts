import { AbstractInputSuggest, Setting, prepareFuzzySearch, type App } from "obsidian";
import { findCatalogDuplicate, labelOf, searchCatalog } from "../core/catalog";
import type { NoteInfo } from "../core/notes";
import type { CatalogDef, CatalogValue, FieldDef } from "../core/types";

export interface FieldContext {
  app: App;
  catalog(id: string | undefined): CatalogDef | undefined;
  get(name: string): unknown;
  /** Store a value. `rerender` redraws the form (use after chip changes, not while typing). */
  set(name: string, value: unknown, rerender?: boolean): void;
  /** Redraws the form without moving the focus. */
  refresh(): void;
  /** Opens the "Create value" dialog; resolves with the new value or null. */
  createValue(field: FieldDef, typed: string): Promise<CatalogValue | null>;
  /** Notes this link field may point to. */
  linkTargets(field: FieldDef): NoteInfo[];
  linkText(note: NoteInfo): string;
  schemaLabel(id: string | undefined): string | undefined;
  /** Label of the type a stub would get, or null if this field can't create stubs. */
  stubLabel(field: FieldDef): string | null;
  /** Creates a stub note of the field's target type; resolves with its link text or null. */
  createStub(field: FieldDef, title: string): Promise<string | null>;
}

const CREATE = "\u0000create";
/** Dispatched on chip inputs before saving, so text typed without Enter is kept. */
export const COMMIT_EVENT = "vaultsmith-commit";

export function flushPendingInputs(container: HTMLElement): void {
  container.querySelectorAll("input.vaultsmith-chip-input").forEach((el) => el.dispatchEvent(new Event(COMMIT_EVENT)));
}
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v === undefined || v === "" ? [] : [String(v)]);
const unwrapLink = (v: string) => v.replace(/^\[\[(.*)\]\]$/, "$1");

export function renderField(container: HTMLElement, field: FieldDef, ctx: FieldContext): void {
  const setting = new Setting(container).setName(field.required ? `${field.label} *` : field.label);
  setting.settingEl.addClass("vaultsmith-field");
  const value = ctx.get(field.name);

  switch (field.type) {
    case "text":
      setting.addText((t) => t.setValue(String(value ?? "")).onChange((v) => ctx.set(field.name, v)));
      break;
    case "number":
      setting.addText((t) => {
        t.inputEl.type = "number";
        t.setValue(value === undefined ? "" : String(value)).onChange((v) => ctx.set(field.name, v === "" ? undefined : Number(v)));
      });
      break;
    case "date":
      setting.addText((t) => {
        t.inputEl.type = "date";
        t.setValue(String(value ?? "")).onChange((v) => ctx.set(field.name, v));
      });
      break;
    case "list":
      renderChips(setting, field, ctx, asList(value), (s) => s);
      break;
    case "link":
      renderLink(setting, field, ctx);
      break;
    case "choice": {
      const catalog = ctx.catalog(field.catalog);
      if (!catalog) break;
      if (field.multiple) renderChoiceChips(setting, field, ctx, catalog);
      else renderChoiceDropdown(setting, field, ctx, catalog);
      break;
    }
  }
}

function renderChoiceDropdown(setting: Setting, field: FieldDef, ctx: FieldContext, catalog: CatalogDef): void {
  const current = ctx.get(field.name);
  setting.addDropdown((d) => {
    if (!field.required) d.addOption("", "—");
    for (const v of catalog.values) d.addOption(v.id, v.label);
    if (typeof current === "string" && current && !catalog.values.some((v) => v.id === current)) {
      d.addOption(current, `${current} (not in catalog)`);
    }
    d.addOption(CREATE, "+ Create value…");
    d.setValue(typeof current === "string" ? current : "");
    d.onChange(async (v) => {
      if (v !== CREATE) return ctx.set(field.name, v || undefined, true);
      const created = await ctx.createValue(field, "");
      ctx.set(field.name, created ? created.id : current, true);
    });
  });
}

function renderChoiceChips(setting: Setting, field: FieldDef, ctx: FieldContext, catalog: CatalogDef): void {
  const selected = asList(ctx.get(field.name));
  const wrap = chipBox(setting);
  for (const id of selected) {
    chip(wrap, labelOf(catalog, id), catalog.values.find((v) => v.id === id)?.color, !catalog.values.some((v) => v.id === id), () =>
      ctx.set(field.name, selected.filter((s) => s !== id), true),
    );
  }
  const input = wrap.createEl("input", { type: "text", cls: "vaultsmith-chip-input", attr: { placeholder: "Add…", "data-field": field.name } });
  new ChoiceSuggest(ctx.app, input, catalog, selected, async (pick) => {
    if (typeof pick !== "string") return ctx.set(field.name, [...selected, pick.id], true);
    const created = await ctx.createValue(field, pick);
    if (created) ctx.set(field.name, [...selected, created.id], true);
  });
}

function renderChips(setting: Setting, field: FieldDef, ctx: FieldContext, items: string[], show: (s: string) => string): void {
  const wrap = chipBox(setting);
  for (const item of items) chip(wrap, show(item), undefined, false, () => ctx.set(field.name, items.filter((i) => i !== item), true));
  const input = wrap.createEl("input", { type: "text", cls: "vaultsmith-chip-input", attr: { placeholder: "Type and press Enter", "data-field": field.name } });
  const commit = (): boolean => {
    if (!input.isConnected) return false; // form was redrawn meanwhile
    const text = input.value.trim();
    input.value = "";
    const list = asList(ctx.get(field.name));
    if (!text || list.some((i) => unwrapLink(i).toLowerCase() === text.toLowerCase())) return false;
    ctx.set(field.name, [...list, text]);
    return true;
  };
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation(); // don't trigger "Create note"
    if (commit()) ctx.set(field.name, ctx.get(field.name), true);
  });
  // Typed text without Enter must not get lost. On blur we wait a moment so a click on a
  // suggestion (which clears the input) wins; "Save" flushes pending text via COMMIT_EVENT.
  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (commit()) ctx.refresh();
    }, 150);
  });
  input.addEventListener(COMMIT_EVENT, () => void commit());
}

function chipBox(setting: Setting): HTMLElement {
  return setting.controlEl.createDiv({ cls: "vaultsmith-chips" });
}

function chip(parent: HTMLElement, text: string, color: string | undefined, invalid: boolean, onRemove: () => void): void {
  const el = parent.createSpan({ cls: "vaultsmith-chip" });
  if (color) el.style.setProperty("--vaultsmith-color", `var(--color-${color})`);
  if (invalid) el.addClass("is-invalid");
  el.createSpan({ text });
  const x = el.createEl("button", { text: "×", cls: "vaultsmith-chip-remove", attr: { "aria-label": `Remove ${text}` } });
  x.addEventListener("click", onRemove);
}

function renderLink(setting: Setting, field: FieldDef, ctx: FieldContext): void {
  const current = asList(ctx.get(field.name)).map(unwrapLink);
  const pick = async (p: LinkPick): Promise<string | null> => {
    if (p.kind === "note") return ctx.linkText(p.note);
    if (p.kind === "create") return ctx.createStub(field, p.title);
    return p.title;
  };

  if (field.multiple) {
    renderChips(setting, field, ctx, current, (s) => s);
    const input = setting.controlEl.querySelector<HTMLInputElement>(`input[data-field="${field.name}"]`)!;
    input.placeholder = "Search notes…";
    new LinkSuggest(ctx, field, input, async (p) => {
      const text = await pick(p);
      if (text && !current.includes(text)) ctx.set(field.name, [...current, text], true);
    });
    return;
  }

  setting.addText((t) => {
    t.setPlaceholder("Search notes…")
      .setValue(current[0] ?? "")
      .onChange((v) => ctx.set(field.name, v));
    t.inputEl.dataset.field = field.name;
    new LinkSuggest(ctx, field, t.inputEl, async (p) => {
      const text = await pick(p);
      if (text) ctx.set(field.name, text, true);
    });
  });
}

type LinkPick =
  | { kind: "note"; note: NoteInfo; alias?: string }
  | { kind: "create"; title: string }
  | { kind: "free"; title: string };

/** Fuzzy search over titles and aliases of the field's link targets. */
class LinkSuggest extends AbstractInputSuggest<LinkPick> {
  private notes: NoteInfo[];

  constructor(
    private ctx: FieldContext,
    private field: FieldDef,
    private input: HTMLInputElement,
    private onPick: (pick: LinkPick) => void,
  ) {
    super(ctx.app, input);
    this.notes = ctx.linkTargets(field);
  }

  getSuggestions(query: string): LinkPick[] {
    const q = query.trim();
    if (!q) return [];
    const fuzzy = prepareFuzzySearch(q);
    const hits: { pick: LinkPick; score: number }[] = [];
    for (const note of this.notes) {
      let best: { score: number; alias?: string } | null = null;
      for (const name of [note.basename, ...note.aliases]) {
        const m = fuzzy(name);
        if (m && (!best || m.score > best.score)) best = { score: m.score, alias: name === note.basename ? undefined : name };
      }
      if (best) hits.push({ pick: { kind: "note", note, alias: best.alias }, score: best.score });
    }
    const picks = hits.sort((a, b) => b.score - a.score).slice(0, 20).map((h) => h.pick);
    const lower = q.toLowerCase();
    const exact = this.notes.some((n) => [n.basename, ...n.aliases].some((x) => x.toLowerCase() === lower));
    if (!exact) picks.push(this.ctx.stubLabel(this.field) ? { kind: "create", title: q } : { kind: "free", title: q });
    return picks;
  }

  renderSuggestion(pick: LinkPick, el: HTMLElement): void {
    if (pick.kind === "create") {
      el.setText(`+ Create ${this.ctx.stubLabel(this.field)!.toLowerCase()} "${pick.title}"`);
      return;
    }
    if (pick.kind === "free") {
      el.setText(`Link to "${pick.title}" (no note yet)`);
      return;
    }
    el.createDiv({ text: pick.note.basename });
    const extra = [pick.alias ? `alias: ${pick.alias}` : "", this.ctx.schemaLabel(pick.note.schemaId) ?? ""].filter(Boolean).join(" · ");
    if (extra) el.createDiv({ text: extra, cls: "vaultsmith-suggest-note" });
  }

  selectSuggestion(pick: LinkPick): void {
    this.input.value = "";
    this.close();
    this.onPick(pick);
  }
}

type ChoicePick = CatalogValue | string;

class ChoiceSuggest extends AbstractInputSuggest<ChoicePick> {
  constructor(
    app: App,
    private input: HTMLInputElement,
    private catalog: CatalogDef,
    private selected: string[],
    private onPick: (pick: ChoicePick) => void,
  ) {
    super(app, input);
  }

  getSuggestions(query: string): ChoicePick[] {
    const hits: ChoicePick[] = searchCatalog(this.catalog, query).filter((v) => !this.selected.includes(v.id));
    if (query.trim() && !findCatalogDuplicate(this.catalog, [query])) hits.push(query.trim());
    return hits;
  }

  renderSuggestion(pick: ChoicePick, el: HTMLElement): void {
    if (typeof pick === "string") {
      el.setText(`+ Create value "${pick}"…`);
      return;
    }
    el.createDiv({ text: pick.label });
    const extra = [pick.aliases?.join(", "), pick.description].filter(Boolean).join(" · ");
    if (extra) el.createDiv({ text: extra, cls: "vaultsmith-suggest-note" });
  }

  selectSuggestion(pick: ChoicePick): void {
    this.input.value = "";
    this.close();
    this.onPick(pick);
  }
}
