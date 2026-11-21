import { AbstractInputSuggest, Setting, type App } from "obsidian";
import { findCatalogDuplicate, labelOf, searchCatalog } from "../core/catalog";
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
}

const CREATE = "\u0000create";
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
      if (field.multiple) renderChips(setting, field, ctx, asList(value).map(unwrapLink), (s) => s);
      else {
        // shortcut: plain text until the vault search in phase 4
        setting.addText((t) =>
          t.setPlaceholder("Note title").setValue(unwrapLink(String(value ?? ""))).onChange((v) => ctx.set(field.name, v)),
        );
      }
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
    const text = input.value.trim();
    input.value = "";
    if (!text || items.some((i) => i.toLowerCase() === text.toLowerCase())) return false;
    ctx.set(field.name, [...items, text]);
    return true;
  };
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation(); // don't trigger "Create note"
    if (commit()) ctx.set(field.name, ctx.get(field.name), true);
  });
  // Typed text without Enter must not get lost when the user clicks "Save" right away:
  // store it now (before the click), redraw the chips afterwards without stealing focus.
  input.addEventListener("blur", () => {
    if (commit()) window.setTimeout(() => ctx.refresh(), 0);
  });
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
