import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: [".claude/**", "tools/oxlint/anti-slop/**"],
  jsPlugins: [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    { name: "llm-core", specifier: "eslint-plugin-llm-core" },
  ],
  rules: {
    "typescript/array-type": ["error", { default: "array" }],
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-widen-then-assert": "error",
    "llm-core/no-llm-artifacts": "error",
  },
});
