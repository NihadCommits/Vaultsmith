import { describe, expect, it } from "vitest";
import { chainOf, detectSchema, fieldsOf, folderOf, isWithin, subtypeValues, templateOf } from "../src/core/resolve";
import { buildConfig } from "../src/core/validate";
import { fixtureFrontmatter, fixtureTitles, starterExists, starterFiles } from "./helpers";

const { schemaFiles, catalogFiles } = starterFiles();
const result = buildConfig(schemaFiles, catalogFiles, starterExists);
const config = result.config!;

describe("starter config", () => {
  it("loads without errors or warnings", () => {
    expect(result.issues).toEqual([]);
    expect(config.root.id).toBe("common");
  });
});

describe("detectSchema on the 14 example notes", () => {
  const expected: Record<string, string> = {
    "Atomic bomb": "topic",
    Bolivia: "country",
    "The Starry Night (1889)": "painting",
    "Early-onset dementia": "medical_condition",
    "Global Positioning System": "system",
    "J. Robert Oppenheimer": "person",
    Menstruation: "process",
    "Menstrual cycle": "topic",
    "Horseshoe crabs": "taxon",
    "RBMK reactor": "topic",
    "Game theory": "topic",
    "Pigeons and doves": "taxon",
    "Vietnam War": "war",
    "Mental squaring": "method",
  };

  it("covers every fixture", () => {
    expect(fixtureTitles().sort()).toEqual(Object.keys(expected).sort());
  });

  for (const [title, schema] of Object.entries(expected)) {
    it(`${title} → ${schema}`, () => {
      const detection = detectSchema(config, fixtureFrontmatter(title));
      expect(detection?.schema.id).toBe(schema);
      expect(detection?.unknown).toBeUndefined();
    });
  }

  it("every fixture only uses keys its schema knows", () => {
    for (const title of fixtureTitles()) {
      const fm = fixtureFrontmatter(title);
      const id = detectSchema(config, fm)!.schema.id;
      const known = new Set([...Object.keys(subtypeValues(config, id)), ...fieldsOf(config, id).map((f) => f.name)]);
      expect(Object.keys(fm).filter((k) => !known.has(k)), title).toEqual([]);
    }
  });
});

describe("detectSchema edge cases", () => {
  it("returns null without a type", () => {
    expect(detectSchema(config, { status: "to_write" })).toBeNull();
    expect(detectSchema(config, null)).toBeNull();
  });

  it("stops at the deepest known schema and reports the unknown value", () => {
    const detection = detectSchema(config, { type: "entity", entity_type: "work", work_type: "sculpture" });
    expect(detection?.schema.id).toBe("work");
    expect(detection?.unknown).toEqual({ field: "work_type", value: "sculpture" });
  });

  it("stops at an intermediate schema when the subtype key is missing", () => {
    expect(detectSchema(config, { type: "entity", entity_type: "work" })?.schema.id).toBe("work");
  });
});

describe("resolution", () => {
  it("builds the chain root first", () => {
    expect(chainOf(config, "painting").map((s) => s.id)).toEqual(["common", "entity", "work", "painting"]);
  });

  it("writes one subtype key per level", () => {
    expect(subtypeValues(config, "painting")).toEqual({ type: "entity", entity_type: "work", work_type: "painting" });
    expect(subtypeValues(config, "topic")).toEqual({ type: "topic" });
  });

  it("puts inherited fields first", () => {
    expect(fieldsOf(config, "painting").map((f) => f.name)).toEqual([
      "domains", "status", "aliases", "related",
      "artist", "creation_year", "art_movement", "medium", "dimensions", "current_location",
    ]);
  });

  it("inherits folder and template from the nearest schema that sets them", () => {
    expect(folderOf(config, "painting")).toBe("20 Knowledge/02 - Entities");
    expect(templateOf(config, "painting")).toBe("Templates/Entities/Painting.md");
    expect(templateOf(config, "system")).toBe("Templates/Entities/Entity.md");
    expect(folderOf(config, "common")).toBeUndefined();
  });

  it("matches link targets by subtree", () => {
    expect(isWithin(config, "country", "place")).toBe(true);
    expect(isWithin(config, "person", "place")).toBe(false);
  });

  it("lets a subtype override an inherited field in place", () => {
    const { config: c } = buildConfig(
      [
        { path: "a.json", text: JSON.stringify({ id: "root", label: "Root", subtypeField: "type", fields: [{ name: "status", label: "Status", type: "text" }, { name: "x", label: "X", type: "text" }] }) },
        { path: "b.json", text: JSON.stringify({ id: "child", label: "Child", extends: "root", fields: [{ name: "status", label: "Stage", type: "text", required: true }] }) },
      ],
      [],
    );
    expect(fieldsOf(c!, "child").map((f) => `${f.name}:${f.label}`)).toEqual(["status:Stage", "x:X"]);
  });
});
