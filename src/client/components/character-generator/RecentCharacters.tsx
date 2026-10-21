import { memo } from "react"
import { useRecentGeneratedCharacters } from "@api/hooks/useRecentGeneratedCharacters"
import { classById } from "@shared/character/classes"
import { stars } from "@lib/character-generator/characterState"
import { capitalize } from "../pokemon-generator/typeColors"

export const RecentCharacters = memo(function RecentCharacters() {
  const { data, isLoading, error } = useRecentGeneratedCharacters()

  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-sm font-light uppercase">
        {`Recently saved${data ? ` (${data.pagination.total} total)` : ""}`}
      </h2>
      {isLoading && <div className="text-sm text-neutral-400">Loading…</div>}
      {error && <div className="text-sm text-red-400">Could not load saved characters</div>}
      {data?.data.length === 0 && <div className="text-sm text-neutral-400">Nothing saved yet</div>}
      <ul className="flex flex-col gap-4">
        {
          data?.data.map(character => (
            <li
              key={character.id}
              className="flex items-center justify-between gap-8 rounded-md bg-neutral-900 py-6 px-8 text-sm"
            >
              <span>{capitalize(character.name)}</span>
              <span className="text-xs text-neutral-400 tabular-nums">
                <span className="text-amber-300">{stars(character.rarity)}</span>
                {` · Lv ${character.level} ${classById(character.class)?.name ?? character.class}`}
              </span>
            </li>
          ))
        }
      </ul>
    </section>
  )
})
