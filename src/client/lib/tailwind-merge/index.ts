import { extendTailwindMerge } from "tailwind-merge"

export { twJoin } from "tailwind-merge"

export { type ClassNameValue } from "tailwind-merge"

export const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
    }
  }
})
