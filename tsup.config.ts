import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["next", "react", "next/navigation", "next/router"],
  treeshake: true,
  minify: true,
  target: "es2020",
  platform: "browser",
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
