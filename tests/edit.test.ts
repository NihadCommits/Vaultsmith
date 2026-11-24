import { describe, expect, it } from "vitest";
import { aliasesAfterRename, managedKeys, removedKeys, valuesFromFrontmatter } from "../src/core/edit";
import { buildFrontmatter } from "../src/core/frontmatter";
import { linkCandidates } from "../src/core/notes";
import { statusInfo, stepStatus } from "../src/core/status";
import { buildConfig } from "../src/core/validate";
import { fixtureFrontmatter, starterExists, starterFiles } from "./helpers";

const { schemaFiles, catalogFiles } = starterFiles();
const config = buildConfig(schemaFiles, catalogFiles, starterExists).config!;

describe("status", () => {
  const info = (fm: Record<string, unknown>) => statusInfo(config, fm, "status");

  it("steps forward and back in catalog order", () => {
    const i = info({ type: "topic", status: "to_write" })!;
    expect(i.index).toBe(0);
    expect(stepStatus(i, 1)).toBe("researching");
    expect(stepStatus(i, -1)).toBeNull();
    expect(stepStatus(info({ type: "topic", status: "finished" })!, 1)).toBeNull();
    expect(stepStatus(info({ type: "topic", status: "finished" })!, -1)).toBe("needs_review");
  });

  it("starts at the first stage when unset", () => {
    const i = info({ type: "topic" })!;
    expect(i.value).toBeUndefined();
    expect(stepStatus(i, 1)).toBe("to_write");
    expect(stepStatus(i, -1)).toBeNull();
  });

  it("marks values outside the catalog as invalid and does not step", () => {
    const i = info({ type: "topic", status: "fertig" })!;
    expect(i.valid).toBe(false);
    expect(stepStatus(i, 1)).toBeNull();
  });

  it("shows for untyped notes only if they have the property", () => {
    expect(info({ tags: ["x"] })).toBeNull();
    expect(info({ status: "writing" })?.index).toBe(2);
  });
});

describe("link candidates", () => {
  const notes = [
    { path: "a.md", basename: "Vincent van Gogh", aliases: ["Van Gogh"], schemaId: "person" },
    { path: "b.md", basename: "Bolivia", aliases: ["Bolivien"], schemaId: "country" },
    { path: "c.md", basename: "Loose note", aliases: [] },
  ];
  it("filters by target subtree", () => {
    expect(linkCandidates(config, notes, "person").map((n) => n.basename)).toEqual(["Vincent van Gogh"]);
    expect(linkCandidates(config, notes, "place").map((n) => n.basename)).toEqual(["Bolivia"]);
    expect(linkCandidates(config, notes, "entity").map((n) => n.basename)).toEqual(["Vincent van Gogh", "Bolivia"]);
  });
  it("offers every note without target", () => {
    expect(linkCandidates(config, notes, undefined)).toHaveLength(3);
  });
});

describe("editing", () => {
  it("knows which keys it manages", () => {
    const keys = managedKeys(config);
    expect(keys.has("work_type")).toBe(true);
    expect(keys.has("artist")).toBe(true);
    expect(keys.has("tags")).toBe(false);
  });

  it("lists painting fields as removed when the type changes to topic, but never foreign keys", () => {
    const current = { ...fixtureFrontmatter("The Starry Night (1889)"), tags: ["art"], cssclasses: ["wide"] };
    const values = valuesFromFrontmatter(config, "painting", current);
    expect(values.type).toBeUndefined();
    const next = buildFrontmatter(config, "topic", values);
    expect(removedKeys(config, current, next)).toEqual([
      "entity_type", "work_type", "artist", "creation_year", "art_movement", "medium", "current_location",
    ]);
  });

  it("lists an emptied field as removed", () => {
    const current = fixtureFrontmatter("Bolivia");
    const values = { ...valuesFromFrontmatter(config, "country", current), continent: undefined };
    expect(removedKeys(config, current, buildFrontmatter(config, "country", values))).toEqual(["continent"]);
  });

  it("keeps the old title as alias after a rename", () => {
    expect(aliasesAfterRename([], "Kreuzkümmel", "Cumin", true)).toEqual(["Kreuzkümmel"]);
    expect(aliasesAfterRename(["kreuzkümmel"], "Kreuzkümmel", "Cumin", true)).toEqual(["kreuzkümmel"]);
    expect(aliasesAfterRename([], "Cumin", "cumin", true)).toEqual([]);
    expect(aliasesAfterRename([], "Kreuzkümmel", "Cumin", false)).toEqual([]);
  });
});
