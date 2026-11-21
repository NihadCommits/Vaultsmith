import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";
import type { RawFile } from "../src/core/types";

export const STARTER = join(__dirname, "..", "src", "starter");
export const FIXTURES = join(__dirname, "fixtures");

function readJsonDir(dir: string): RawFile[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({
      path: relative(STARTER, join(dir, f)).replace(/\\/g, "/"),
      text: readFileSync(join(dir, f), "utf8"),
    }));
}

export const starterFiles = () => ({
  schemaFiles: readJsonDir(join(STARTER, "_Vaultsmith", "Schemas")),
  catalogFiles: readJsonDir(join(STARTER, "_Vaultsmith", "Catalogs")),
});

/** Template paths resolve against the starter folder; default folders only exist in a real vault. */
export const starterExists = (path: string) => path.startsWith("20 Knowledge/") || existsSync(join(STARTER, path));

export function fixtureFrontmatter(title: string): Record<string, unknown> {
  const text = readFileSync(join(FIXTURES, `${title}.md`), "utf8");
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) throw new Error(`No frontmatter in ${title}`);
  return parse(match[1]) as Record<string, unknown>;
}

export const fixtureTitles = () =>
  readdirSync(FIXTURES)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3));
