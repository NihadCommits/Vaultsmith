import esbuild from "esbuild";
import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative } from "node:path";

const prod = process.argv[2] === "production";

/** `import starter from "virtual:starter"` → { "relative/path": "file content", ... } of src/starter. */
const starterFiles = {
  name: "starter-files",
  setup(build) {
    build.onResolve({ filter: /^virtual:starter$/ }, () => ({ path: "starter", namespace: "starter" }));
    build.onLoad({ filter: /.*/, namespace: "starter" }, () => {
      const dir = "src/starter";
      const files = {};
      for (const f of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
        const full = join(dir, f);
        if (!/\.(json|md|base)$/.test(f)) continue;
        files[relative(dir, full).replace(/\\/g, "/")] = readFileSync(full, "utf8").replace(/\r\n/g, "\n");
      }
      return { contents: `export default ${JSON.stringify(files)};`, loader: "js", watchDirs: [dir] };
    });
  },
};

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules],
  format: "cjs",
  target: "es2021",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  minify: prod,
  outfile: "main.js",
  plugins: [starterFiles],
});

if (prod) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
}
