import { SuggestModal, TFile, type App } from "obsidian";
import { searchCatalog } from "../core/catalog";
import { statusInfo, stepStatus, type StatusInfo } from "../core/status";
import type { CatalogValue } from "../core/types";
import type VaultsmithPlugin from "../main";

/** `‹ ● Researching ›` in Obsidian's status bar for the active note. */
export class StatusBar {
  private el: HTMLElement;

  constructor(private plugin: VaultsmithPlugin) {
    this.el = plugin.addStatusBarItem();
    this.el.addClass("vaultsmith-status");
    const { workspace, metadataCache } = plugin.app;
    plugin.registerEvent(workspace.on("active-leaf-change", () => this.update()));
    plugin.registerEvent(workspace.on("file-open", () => this.update()));
    plugin.registerEvent(
      metadataCache.on("changed", (file) => {
        if (file === workspace.getActiveFile()) this.update();
      }),
    );
    this.update();
  }

  /** Active markdown note and its status, if it has one. */
  current(): { file: TFile; info: StatusInfo } | null {
    const { app, config, settings } = this.plugin;
    const file = app.workspace.getActiveFile();
    if (!config || !(file instanceof TFile) || file.extension !== "md") return null;
    const info = statusInfo(config, app.metadataCache.getFileCache(file)?.frontmatter, settings.statusField);
    return info ? { file, info } : null;
  }

  update(): void {
    this.el.empty();
    const cur = this.current();
    this.el.toggle(cur !== null);
    if (!cur) return;
    const { file, info } = cur;
    const value = info.catalog.values[info.index];

    const arrow = (text: string, dir: 1 | -1, label: string) => {
      const target = stepStatus(info, dir);
      const btn = this.el.createSpan({ text, cls: "vaultsmith-status-arrow", attr: { "aria-label": label } });
      if (target === null) btn.addClass("is-disabled");
      else btn.addEventListener("click", () => void this.plugin.setStatus(file, info.field.name, target));
    };

    arrow("‹", -1, "Previous status");
    const label = this.el.createSpan({ cls: "vaultsmith-status-label", attr: { "aria-label": "Set status" } });
    const dot = label.createSpan({ text: "●", cls: "vaultsmith-status-dot" });
    if (value?.color) dot.style.setProperty("color", `var(--color-${value.color})`);
    label.createSpan({ text: info.valid ? value?.label ?? "No status" : `${info.value} (unknown)` });
    if (!info.valid) label.addClass("is-invalid");
    label.addEventListener("click", () => this.plugin.pickStatus());
    arrow("›", 1, "Next status");
  }
}

export class StatusPickerModal extends SuggestModal<CatalogValue> {
  constructor(app: App, private info: StatusInfo, private onPick: (value: CatalogValue) => void) {
    super(app);
    this.setPlaceholder(`Set ${info.field.label.toLowerCase()}…`);
  }

  getSuggestions(query: string): CatalogValue[] {
    return searchCatalog(this.info.catalog, query);
  }

  renderSuggestion(value: CatalogValue, el: HTMLElement): void {
    const row = el.createDiv({ cls: "vaultsmith-status-option" });
    const dot = row.createSpan({ text: "● ", cls: "vaultsmith-status-dot" });
    if (value.color) dot.style.setProperty("color", `var(--color-${value.color})`);
    row.createSpan({ text: value.id === this.info.value ? `${value.label} (current)` : value.label });
    if (value.description) el.createDiv({ text: value.description, cls: "vaultsmith-suggest-note" });
  }

  onChooseSuggestion(value: CatalogValue): void {
    this.onPick(value);
  }
}
