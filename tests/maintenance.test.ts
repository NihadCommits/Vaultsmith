import { describe, expect, it } from "vitest";
import { catalogFieldNames, countUsage, lintNote, moveValue, removeValue, renameValue, updateValue } from "../src/core/maintenance";
import { buildConfig } from "../src/core/validate";
import { fixtureFrontmatter, fixtureTitles, starterExists, starterFiles } from "./helpers";

const { schemaFiles, catalogFiles } = starterFiles();
const config = buildConfig(schemaFiles, catalogFiles, starterExists).config!;
const statuses = config.catalogs.get("statuses")!;

describe("catalog edits", () => {
  it("moves values and stops at the edges", () => {
    expect(moveValue(statuses, "writing", -1).values.map((v) => v.id).slice(0, 3)).toEqual(["to_write", "writing", "researching"]);
    expect(moveValue(statuses, "to_write", -1)).toBe(statuses);
  });

  it("updates a value and drops empty optional keys", () => {
    const updated = updateValue(statuses, "writing", { label: "Drafting", aliases: [], description: " " });
    expect(updated.values.find((v) => v.id === "writing")).toEqual({ id: "writing", label: "Drafting", color: "orange" });
    expect(statuses.values.find((v) => v.id === "writing")?.label).toBe("Writing"); // original untouched
  });

  it("removes a value", () => {
    expect(removeValue(statuses, "finished").values).toHaveLength(4);
  });
});

describe("usage and rename", () => {
  const notes = fixtureTitles().map(fixtureFrontmatter);

  it("finds the fields backed by a catalog", () => {
    expect([...catalogFieldNames(config, "domains")]).toEqual(["domains"]);
  });

  it("counts notes using a value", () => {
    expect(countUsage(config, notes, "statuses", "to_write")).toBe(14);
    expect(countUsage(config, notes, "domains", "physics")).toBe(4);
    expect(countUsage(config, notes, "domains", "geology")).toBe(0);
  });

  it("renames ids in single and list fields without duplicates", () => {
    const fm: Record<string, unknown> = { status: "writing", domains: ["arts", "art_history"] };
    expect(renameValue(fm, new Set(["status"]), "writing", "drafting")).toBe(true);
    expect(renameValue(fm, new Set(["domains"]), "art_history", "arts")).toBe(true);
    expect(fm).toEqual({ status: "drafting", domains: ["arts"] });
    expect(renameValue(fm, new Set(["domains"]), "physics", "x")).toBe(false);
  });
});

describe("lintNote", () => {
  it("finds nothing wrong in the examples", () => {
    for (const title of fixtureTitles()) expect(lintNote(config, fixtureFrontmatter(title), true), title).toEqual([]);
  });

  it("reports missing types only where a type is expected", () => {
    expect(lintNote(config, { tags: ["x"] }, true)).toEqual(["No type"]);
    expect(lintNote(config, { tags: ["x"] }, false)).toEqual([]);
  });

  it("reports wrong values, foreign fields, missing required fields and abstract types", () => {
    expect(lintNote(config, { type: "topic", status: "fertig", artist: "[[X]]" }, true)).toEqual([
      '"artist" does not belong to Topic',
      'Status: "fertig" is not in Status',
      "Domains is missing",
    ]);
    expect(lintNote(config, { type: "entity", domains: ["arts"], status: "to_write" }, true)).toEqual(['"Entity" needs a subtype']);
    expect(lintNote(config, { type: "entity", entity_type: "work", work_type: "sculpture", domains: ["arts"], status: "to_write" }, true)).toEqual([
      'Unknown work_type "sculpture"',
    ]);
  });

  it("leaves foreign keys alone", () => {
    expect(lintNote(config, { type: "topic", domains: ["physics"], status: "to_write", tags: ["a"], cssclasses: ["b"] }, true)).toEqual([]);
  });
});
