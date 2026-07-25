import react from "eslint-plugin-react";

export default [
  {
    // Flat-config ESLint does not read .gitignore. Keep build artefacts,
    // generated clients, and local tooling out of the application lint pass.
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "blob-report/**",
      ".vercel/**",
      ".turbo/**",
      "app/generated/**",
      "demo/**",
      ".agents/**",
      ".codex/**",
    ],
  },
  {
    files: ["**/*.js", "**/*.jsx"],
    plugins: {
      react,
    },
    rules: {
      // Core ESLint does not treat a JSX tag as a variable use on its own.
      // Without this marker, every imported or local component is false noise.
      "react/jsx-uses-vars": "error",
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
        varsIgnorePattern: "^_",
      }],
      "no-const-assign": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-unsafe-negation": "error",
      "use-isnan": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "warn",
      "no-loss-of-precision": "error",
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ["components/**/*.js", "components/**/*.jsx"],
    rules: {
      // Financial and permission services use the .server suffix. Keep client
      // components from importing those modules even though tests and API
      // routes may exercise them directly.
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/*.server", "**/*.server.js"],
          message: "Server-only modules must be called from an API or server boundary.",
        }],
      }],
    },
  },
];
