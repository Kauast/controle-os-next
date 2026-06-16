import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "backend-senior/**",
      "services/**",
      ".claude/**",
      ".superpowers/**",
      "scripts/**",
      // Assets minificados do build Capacitor Android — não fazer lint
      "android/**",
      // Build estático para o app mobile (Capacitor)
      "out-mobile/**",
    ],
  },
];

export default eslintConfig;
