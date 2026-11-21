import { describe, expect, it } from "vitest";
import { findCatalogDuplicate, searchCatalog } from "../src/core/catalog";
import { sanitizeTitle, slugify } from "../src/core/filename";
import { buildFrontmatter, defaultValues, missingRequired, toLink } from "../src/core/frontmatter";
import { aliasesOf, findDuplicates } from "../src/core/notes";
import { fillPlaceholders, mergeFrontmatter, splitFrontmatter } from "../src/core/template";
import { buildConfig } from "../src/core/validate";
import { fixtureFrontmatter, starterExists, starterFiles } from "./helpers";

const { schemaFiles, catalogFiles } = starterFiles();
const config = buildConfig(schemaFiles, catalogFiles, starterExists).config!;

describe("sanitizeTitle", () => {
  it("keeps normal titles", () => {
    expect(sanitizeTitle("The Starry Night (1889)")).toEqual({ fileName: "The Starry Night (1889)", changed: false });
  });
  it("replaces forbidden and link-breaking characters", () => {
    expect(sanitizeTitle("AC/DC").fileName).toBe("AC-DC");
    expect(sanitizeTitle("What is time?").fileName).toBe("What is time-");
    expect(sanitizeTitle("C# [draft] ^x").fileName).toBe("C- -draft- -x");
    expect(sanitizeTitle("AC/DC").changed).toBe(true);
  });
  it("drops leading dots and trailing dots/spaces", () => {
    expect(sanitizeTitle(".hidden").fileName).toBe("hidden");
    expect(sanitizeTitle("Etc.  ").fileName).toBe("Etc");
  });
});

describe("slugify", () => {
  it("makes snake_case ascii ids", () => {
    expect(slugify("Art history")).toBe("art_history");
    expect(slugify("Öl auf Leinwand")).toBe("oel_auf_leinwand");
    expect(slugify("  Straße / Café ")).toBe("strasse_cafe");
  });
});

describe("buildFrontmatter", () => {
  it("reproduces the Starry Night example exactly, in order", () => {
    const fm = buildFrontmatter(config, "painting", {
      domains: ["arts", "art_history"],
      status: "to_write",
      aliases: ["Die Sternennacht"],
      artist: "Vincent van Gogh",
      creation_year: "1889",
      art_movement: "[[Post-Impressionism]]",
      medium: "oil_on_canvas",
      dimensions: "",
      current_location: "Museum of Modern Art",
      related: [],
    });
    expect(fm).toEqual(fixtureFrontmatter("The Starry Night (1889)"));
    expect(Object.keys(fm)).toEqual(Object.keys(fixtureFrontmatter("The Starry Night (1889)")));
  });

  it("ignores values of fields the type does not have", () => {
    expect(buildFrontmatter(config, "topic", { domains: ["physics"], status: "to_write", artist: "Picasso" })).toEqual({
      type: "topic",
      domains: ["physics"],
      status: "to_write",
    });
  });

  it("keeps single values of list fields as lists and drops invalid numbers", () => {
    const fm = buildFrontmatter(config, "person", { domains: "physics", occupations: "physicist", related: "Manhattan Project" });
    expect(fm.domains).toEqual(["physics"]);
    expect(fm.occupations).toEqual(["physicist"]);
    expect(fm.related).toEqual(["[[Manhattan Project]]"]);
    expect(buildFrontmatter(config, "event", { start_year: "abc" }).start_year).toBeUndefined();
    expect(buildFrontmatter(config, "event", { start_year: "-44" }).start_year).toBe(-44);
  });

  it("knows defaults and required fields", () => {
    expect(defaultValues(config, "topic")).toEqual({ status: "to_write" });
    expect(missingRequired(config, "topic", { status: "to_write" }).map((f) => f.name)).toEqual(["domains"]);
    expect(missingRequired(config, "topic", { status: "to_write", domains: ["physics"] })).toEqual([]);
  });

  it("wraps links once", () => {
    expect(toLink("X")).toBe("[[X]]");
    expect(toLink("[[X]]")).toBe("[[X]]");
  });
});

describe("findDuplicates", () => {
  const notes = [
    { path: "a/Horseshoe crabs.md", basename: "Horseshoe crabs", aliases: ["Pfeilschwanzkrebse"] },
    { path: "b/Mercury.md", basename: "Mercury", aliases: [] },
  ];
  it("matches names and aliases case-insensitively", () => {
    expect(findDuplicates(["pfeilschwanzkrebse"], notes).map((d) => d.note.basename)).toEqual(["Horseshoe crabs"]);
    expect(findDuplicates(["MERCURY"], notes)[0].matched).toBe("Mercury");
    expect(findDuplicates(["Mercury (planet)"], notes)).toEqual([]);
  });
  it("reads aliases as list or string", () => {
    expect(aliasesOf({ aliases: ["a", 1, "b"] })).toEqual(["a", "b"]);
    expect(aliasesOf({ aliases: "a" })).toEqual(["a"]);
    expect(aliasesOf(undefined)).toEqual([]);
  });
});

describe("templates", () => {
  it("splits frontmatter, also with CRLF", () => {
    expect(splitFrontmatter("---\r\ntags: x\r\n---\r\n## A\r\n")).toEqual({ yaml: "tags: x", body: "## A\n" });
    expect(splitFrontmatter("## A\n")).toEqual({ yaml: null, body: "## A\n" });
  });
  it("fills placeholders like core Templates", () => {
    const fmt = (p: string) => `<${p}>`;
    expect(fillPlaceholders("{{title}} {{date}} {{time}} {{date:DD.MM.YYYY}} {{ Title }}", "X", fmt)).toBe(
      "X <YYYY-MM-DD> <HH:mm> <DD.MM.YYYY> X",
    );
  });
  it("lets schema values win over template frontmatter", () => {
    expect(mergeFrontmatter({ type: "topic", status: "to_write" }, { status: "seed", cssclasses: ["wide"] })).toEqual({
      type: "topic",
      status: "to_write",
      cssclasses: ["wide"],
    });
  });
});

describe("catalog search", () => {
  const domains = config.catalogs.get("domains")!;
  it("finds values by German alias, prefix first", () => {
    expect(searchCatalog(domains, "physik")[0].id).toBe("physics");
    expect(searchCatalog(domains, "kunst").map((v) => v.id)).toEqual(["arts", "art_history"]);
  });
  it("detects duplicates by id, label or alias", () => {
    expect(findCatalogDuplicate(domains, ["Kunstgeschichte"])?.id).toBe("art_history");
    expect(findCatalogDuplicate(domains, ["neuroscience", "Neurowissenschaft"])).toBeUndefined();
  });
});
