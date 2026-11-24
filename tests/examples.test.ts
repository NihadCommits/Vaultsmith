import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildFrontmatter } from "../src/core/frontmatter";
import { detectSchema } from "../src/core/resolve";
import { buildConfig } from "../src/core/validate";
import type { RawFile } from "../src/core/types";

const EXAMPLES = join(__dirname, "..", "examples");
const read = (dir: string): RawFile[] =>
  readdirSync(dir).map((f) => ({ path: `${dir.split(/[\\/]/).slice(-2).join("/")}/${f}`, text: readFileSync(join(dir, f), "utf8") }));
const load = (name: string) => {
  const dir = join(EXAMPLES, name);
  const catalogs = read(join(dir, "Catalogs")).map((f) => ({ ...f, path: `Catalogs/${f.path.split("/").pop()}` }));
  return buildConfig(read(join(dir, "Schemas")), catalogs);
};

describe("examples/", () => {
  for (const name of readdirSync(EXAMPLES)) {
    it(`${name} is a valid config`, () => {
      expect(load(name).issues).toEqual([]);
    });
  }

  it("kitchen: a spice note round-trips through detection", () => {
    const config = load("kitchen").config!;
    const fm = buildFrontmatter(config, "spice", { status: "tried", season: "autumn", heat: "medium", aliases: ["Kreuzkümmel"] });
    expect(fm).toEqual({ type: "ingredient", ingredient_type: "spice", status: "tried", aliases: ["Kreuzkümmel"], season: ["autumn"], heat: "medium" });
    expect(detectSchema(config, fm)?.schema.id).toBe("spice");
  });
});
