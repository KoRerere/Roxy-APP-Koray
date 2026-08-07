import { builtinModules } from "node:module";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

// Externalize Node builtins and all runtime dependencies so the bundle stays
// small and relies on node_modules at runtime (standard Node CLI build pattern).
const external = [...builtinModules, ...builtinModules.map((m) => `node:${m}`), ...Object.keys(pkg.dependencies ?? {})];

export default defineConfig({
  build: {
    target: "es2024",
    outDir: "dist",
    emptyOutDir: true,
    minify: true,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external,
    },
  },
});
