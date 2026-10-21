import { memo } from "react"
import { useRecentGeneratedPokemon } from "@api/hooks/useRecentGeneratedPokemon"
import type { PokemonType } from "@shared/api/schema/pokemon/generated"
import { classLabel } from "@lib/pokemon-generator/generatorState"
import { TYPE_COLORS, capitalize } from "./typeColors"

export const RecentPokemon = memo(function RecentPokemon() {
  const { data, isLoading, error } = useRecentGeneratedPokemon()

  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-sm font-light uppercase">
        {`Recently saved${data ? ` (${data.pagination.total} total)` : ""}`}
      </h2>
      {isLoading && <div className="text-sm text-neutral-400">Loading…</div>}
      {error && <div className="text-sm text-red-400">Could not load saved pokemon</div>}
      {data?.data.length === 0 && <div className="text-sm text-neutral-400">Nothing saved yet</div>}
      <ul className="flex flex-col gap-4">
        {
          data?.data.map(pokemon => (
            <li key={pokemon.id} className="flex items-center justify-between gap-8 rounded-md bg-neutral-900 py-6 px-8 text-sm">
              <span className="flex items-center gap-6">
                {
                  pokemon.types.map(type => (
                    <span
                      key={type}
                      className="h-8 w-8 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[type as PokemonType] }}
                    />
                  ))
                }
                {capitalize(pokemon.name)}
              </span>
              <span className="text-xs text-neutral-400 tabular-nums">
                {`${classLabel(pokemon)} · BST ${Object.values(pokemon.stats).reduce((sum, value) => sum + value, 0)}`}
              </span>
            </li>
          ))
        }
      </ul>
    </section>
  )
})
