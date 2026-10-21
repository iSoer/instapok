import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { POKEMON_TYPES, type PokemonType } from "@shared/api/schema/pokemon/generated"
import { MAX_TYPES } from "@lib/pokemon-generator/generatorState"
import { TYPE_COLORS, capitalize } from "./typeColors"

export type TypePickerPropsType = {
  // Primary first
  selected: PokemonType[]
  onToggle: (type: PokemonType) => void
}

export const TypePicker = memo(function TypePicker({ selected, onToggle }: TypePickerPropsType) {
  return (
    <fieldset className="flex flex-col gap-8">
      <legend className="mb-8 text-sm font-light uppercase">
        {`Types (up to ${MAX_TYPES}; the first is primary, a third replaces the second)`}
      </legend>
      <div className="grid grid-cols-3 gap-6 sm:grid-cols-6">
        {
          POKEMON_TYPES.map((type) => {
            const position = selected.indexOf(type)
            const active = position >= 0

            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(type)}
                className={twMerge(
                  "relative py-6 px-8 rounded-md",
                  "text-sm font-medium",
                  "border transition-colors",
                  active ? "text-neutral-950" : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500"
                )}
                style={active ? { backgroundColor: TYPE_COLORS[type], borderColor: TYPE_COLORS[type] } : undefined}
              >
                {capitalize(type)}
                {
                  active && (
                    <span
                      className={twMerge(
                        "absolute -top-6 -right-6 flex h-16 w-16 items-center justify-center",
                        "rounded-full bg-neutral-950 text-[10px] text-white"
                      )}
                    >
                      {position + 1}
                    </span>
                  )
                }
              </button>
            )
          })
        }
      </div>
    </fieldset>
  )
})
