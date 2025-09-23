import globals from "globals";
import { defineConfig,  globalIgnores } from "eslint/config";

export default defineConfig([
  { 
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.browser }
  },
  globalIgnores([
    "node_modules",
    "dist",
    "coverage"
  ])
]);
