import { describe, expect, it } from "vitest";
import { buildConfig } from "../src/core/validate";
import type { RawFile } from "../src/core/types";

const schema = (obj: object, path = `Schemas/${(obj as { id: string }).id}.json`): RawFile => ({ path, text: JSON.stringify(obj) });
const catalog = (id: string, values: object[], path = `Catalogs/${id}.json`): RawFile => ({ path, text: JSON.stringify({ id, label: id, values }) });

const root = { id: "common", label: "Note", subtypeField: "type", fields: [{ name: "status", label: "Status", type: "choice", catalog: "statuses", default: "to_write" }] };
const topic = { id: "topic", label: "Topic", extends: "common" };
const statuses = catalog("statuses", [{ id: "to_write", label: "To write" }, { id: "finished", label: "Finished" }]);

const run = (schemas: RawFile[], catalogs: RawFile[] = [statuses], exists?: (p: string) => boolean) =>
  buildConfig(schemas, catalogs, exists);
const errors = (r: ReturnType<typeof buildConfig>) => r.issues.filter((i) => i.level === "error");
const warnings = (r: ReturnType<typeof buildConfig>) => r.issues.filter((i) => i.level === "warning");

describe("buildConfig", () => {
  it("accepts a minimal valid config", () => {
    const r = run([schema(root), schema(topic)]);
    expect(r.issues).toEqual([]);
    expect(r.config?.children.get("common")?.map((s) => s.id)).toEqual(["topic"]);
  });

  it("reports broken JSON with file and reason, and returns no config", () => {
    const r = run([schema(root), { path: "Schemas/broken.json", text: '{ "id": "x", ' }]);
    expect(r.config).toBeUndefined();
    expect(errors(r)).toHaveLength(1);
    expect(errors(r)[0].file).toBe("Schemas/broken.json");
    expect(errors(r)[0].message).toMatch(/^Invalid JSON: /);
  });

  it("requires id and label", () => {
    expect(errors(run([schema(root), { path: "Schemas/x.json", text: '{ "label": "X" }' }]))[0].message).toMatch(/needs "id" and "label"/);
  });

  it("requires exactly one root", () => {
    expect(errors(run([schema(root), schema({ id: "other", label: "Other" })]))[0].message).toMatch(/Found 2: common, other/);
    expect(errors(run([]))[0].message).toBe("No schemas found.");
  });

  it("rejects unknown extends", () => {
    expect(errors(run([schema(root), schema({ id: "x", label: "X", extends: "nope" })]))[0].message).toMatch(/unknown schema "nope"/);
  });

  it("rejects extends of a parent without subtypeField", () => {
    const r = run([schema(root), schema({ id: "map", label: "Map", extends: "common" }), schema({ id: "x", label: "X", extends: "map" })]);
    expect(errors(r)[0].message).toMatch(/"map" has no "subtypeField"/);
  });

  it("rejects cycles", () => {
    const r = run([
      schema(root),
      schema({ id: "a", label: "A", extends: "b", subtypeField: "a_type" }),
      schema({ id: "b", label: "B", extends: "a", subtypeField: "b_type" }),
    ]);
    expect(errors(r).some((i) => /cycle/.test(i.message))).toBe(true);
    expect(r.config).toBeUndefined();
  });

  it("rejects duplicate ids", () => {
    expect(errors(run([schema(root), schema(topic), schema(topic, "Schemas/copy.json")]))[0].message).toMatch(/Duplicate schema id "topic"/);
    expect(errors(run([schema(root)], [statuses, catalog("statuses", [], "Catalogs/sub/statuses.json")]))[0].message).toMatch(/Duplicate catalog id/);
    expect(errors(run([schema(root)], [catalog("statuses", [{ id: "to_write", label: "A" }, { id: "to_write", label: "B" }])]))[0].message).toMatch(/Duplicate value id "to_write"/);
  });

  it("requires catalog id = file name", () => {
    expect(errors(run([schema(root)], [statuses, catalog("art_media", [], "Catalogs/art-media.json")]))[0].message).toMatch(/must match the file name "art-media.json"/);
  });

  it("rejects unknown field types", () => {
    const r = run([schema(root), schema({ ...topic, fields: [{ name: "artist", label: "Artist", type: "entity_link" }] })]);
    expect(errors(r)[0].message).toMatch(/unknown type "entity_link"/);
  });

  it("rejects choice fields without an existing catalog", () => {
    const r = run([schema(root), schema({ ...topic, fields: [{ name: "medium", label: "Medium", type: "choice", catalog: "art_media" }] })]);
    expect(errors(r)[0].message).toMatch(/catalog "art_media" not found/);
  });

  it("rejects defaults that are not in the catalog", () => {
    const r = run([schema({ ...root, fields: [{ ...root.fields[0], default: "seed" }] })]);
    expect(errors(r)[0].message).toMatch(/default "seed" is not in catalog "statuses"/);
  });

  it("rejects unknown link targets", () => {
    const r = run([schema(root), schema({ ...topic, fields: [{ name: "artist", label: "Artist", type: "link", target: "person" }] })]);
    expect(errors(r)[0].message).toMatch(/link target "person" is not a schema/);
  });

  it("rejects the same property name with different types", () => {
    const r = run([
      schema(root),
      schema({ ...topic, subtypeField: "topic_type", fields: [{ name: "year", label: "Year", type: "number" }] }),
      schema({ id: "x", label: "X", extends: "topic", fields: [{ name: "year", label: "Year", type: "text" }] }),
    ]);
    expect(errors(r)[0].message).toMatch(/must have the same type everywhere/);
  });

  it("rejects fields named like a subtypeField", () => {
    const r = run([schema(root), schema({ ...topic, fields: [{ name: "type", label: "Type", type: "text" }] })]);
    expect(errors(r)[0].message).toMatch(/already used as a "subtypeField"/);
  });

  it("warns about missing folders, templates and unknown colors but still returns a config", () => {
    const r = run(
      [schema(root), schema({ ...topic, defaultFolder: "Topics", template: "Templates/Topic.md" })],
      [catalog("statuses", [{ id: "to_write", label: "To write", color: "teal" }])],
      () => false,
    );
    expect(errors(r)).toEqual([]);
    expect(warnings(r).map((w) => w.message)).toEqual([
      expect.stringMatching(/unknown color "teal"/),
      expect.stringMatching(/folder "Topics" does not exist/),
      expect.stringMatching(/template "Templates\/Topic.md" not found/),
    ]);
    expect(r.config).toBeDefined();
  });
});

describe("README example config", () => {
  it("is valid and resolves", () => {
    const r = buildConfig(
      [
        schema({ id: "note", label: "Note", abstract: true, subtypeField: "type", fields: [{ name: "status", label: "Status", type: "choice", catalog: "statuses", default: "to_write" }] }),
        schema({ id: "book", label: "Book", extends: "note", defaultFolder: "Reading/Books", fields: [{ name: "author", label: "Author", type: "link", target: "person" }, { name: "year", label: "Year", type: "number" }] }),
        schema({ id: "person", label: "Person", extends: "note", defaultFolder: "People" }),
      ],
      [catalog("statuses", [{ id: "to_write", label: "To write" }, { id: "in_progress", label: "In progress", color: "orange" }, { id: "done", label: "Done", color: "green" }])],
    );
    expect(r.issues).toEqual([]);
    expect(r.config?.children.get("note")?.map((s) => s.id)).toEqual(["book", "person"]);
  });
});
