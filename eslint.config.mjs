import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import stylistic from "@stylistic/eslint-plugin"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "@stylistic": stylistic
    },
    ...stylistic.configs.recommended
  },
  {
    rules: {
      "@next/next/no-img-element": "off",
      "@stylistic/max-len": ["error", { code: 130 }],
      "@stylistic/quotes": ["error", "double"],
      "@stylistic/comma-dangle": ["error", { generics: "ignore" }]
    }
  },
  {
    // Procedural SVG art of the game: the markup lives in template literals, wrapping it would not read better
    files: ["src/client/game/art/**"],
    rules: {
      "@stylistic/max-len": "off"
    }
  },
  globalIgnores([
    // Default ignores of eslint-config-next
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local postgres data volume
    "docker/**"
  ])
])

export default eslintConfig
