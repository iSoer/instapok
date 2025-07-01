import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"
import stylistic from "@stylistic/eslint-plugin"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname
})

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
  }
]

export default eslintConfig
