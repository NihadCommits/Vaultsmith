import { Modal, type App } from "obsidian";
import type { Config, Issue } from "../core/types";

export class IssuesModal extends Modal {
  constructor(app: App, private issues: Issue[], private config: Config | undefined) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText("Vaultsmith configuration");
    const errors = this.issues.filter((i) => i.level === "error");
    const warnings = this.issues.filter((i) => i.level === "warning");

    if (errors.length === 0) {
      contentEl.createEl("p", {
        text: `Configuration OK: ${this.config?.schemas.size ?? 0} schemas, ${this.config?.catalogs.size ?? 0} catalogs.`,
      });
    } else {
      contentEl.createEl("p", {
        text: this.config
          ? "The configuration has errors. Vaultsmith keeps using the last valid version until they are fixed."
          : "The configuration has errors and there is no valid version yet.",
      });
    }
    this.renderList("Errors", errors);
    this.renderList("Warnings", warnings);
  }

  private renderList(title: string, issues: Issue[]): void {
    if (issues.length === 0) return;
    this.contentEl.createEl("h3", { text: `${title} (${issues.length})` });
    const list = this.contentEl.createEl("ul");
    for (const issue of issues) {
      const item = list.createEl("li");
      if (issue.file) item.createEl("code", { text: issue.file });
      item.appendText(issue.file ? ` ${issue.message}` : issue.message);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
