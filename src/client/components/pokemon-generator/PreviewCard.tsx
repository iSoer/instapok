import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { STATS, type GeneratedPokemonType, type PokemonType } from "@shared/api/schema/pokemon/generated"
import type { Issue } from "@lib/pokemon-generator/generatorState"
import { FIELD_CLASS, STAT_LABELS, TYPE_COLORS, abilityLabel, capitalize } from "./typeColors"
import type { AbilityDescription } from "./AbilityPicker"

export type PreviewState
  = | { status: "idle" }
    | { status: "loading" }
    | { status: "ok", pokemon: GeneratedPokemonType }
    | { status: "error", error: string, violations: string[] }

export type PreviewCardPropsType = {
  preview: PreviewState
  issues: Issue[]
  name: string
  descriptions: Map<string, AbilityDescription>
  busy: boolean
  canDistribute: boolean
  // Result of the last button action: saved, or why it failed
  message?: { level: "ok" | "error", text: string, details?: string[] }
  onNameChange: (name: string) => void
  onSave: () => void
  onRandom: () => void
  onDistribute: () => void
  onReroll: () => void
}

const button = (variant: "primary" | "secondary") => twMerge(
  "py-8 px-12 rounded-md text-sm font-medium transition-colors",
  "disabled:cursor-not-allowed disabled:opacity-40",
  variant === "primary" ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
)

const MAX_STAT = 255

export const PreviewCard = memo(function PreviewCard({
  preview,
  issues,
  name,
  descriptions,
  busy,
  canDistribute,
  message,
  onNameChange,
  onSave,
  onRandom,
  onDistribute,
  onReroll
}: PreviewCardPropsType) {
  const errors = issues.filter(issue => issue.level === "error")
  const notes = issues.filter(issue => issue.level === "info")
  const pokemon = preview.status === "ok" ? preview.pokemon : undefined
  const canSave = errors.length === 0 && preview.status === "ok" && !busy

  return (
    <section className="flex flex-col gap-16 rounded-lg border border-neutral-800 bg-neutral-950 p-16">
      <label className="flex flex-col gap-8">
        <span className="text-sm font-light uppercase">Name</span>
        <input
          value={name}
          maxLength={40}
          placeholder={pokemon?.name ?? "generated from the seed"}
          onChange={event => onNameChange(event.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          className={FIELD_CLASS}
        />
      </label>

      <div className="flex flex-wrap gap-8">
        <button type="button" className={button("secondary")} disabled={busy} onClick={onRandom}>🎲 Random</button>
        <button
          type="button"
          className={button("secondary")}
          disabled={busy || !canDistribute}
          title="Split the budget the way the model would for these types and abilities"
          onClick={onDistribute}
        >
          Distribute by model
        </button>
        <button
          type="button"
          className={button("secondary")}
          disabled={busy}
          title="New height, weight and name"
          onClick={onReroll}
        >
          New seed
        </button>
      </div>

      {
        errors.length > 0 && (
          <ul className="flex flex-col gap-4 text-sm text-red-400">
            {errors.map(issue => <li key={issue.text}>{issue.text}</li>)}
          </ul>
        )
      }
      {notes.map(issue => <div key={issue.text} className="text-sm text-neutral-400">{issue.text}</div>)}

      {preview.status === "loading" && <div className="text-sm text-neutral-400">Checking with the model…</div>}
      {
        preview.status === "error" && (
          <div className="flex flex-col gap-4 text-sm text-red-400">
            <span>{preview.error}</span>
            {preview.violations.map(violation => <span key={violation}>{`• ${violation}`}</span>)}
          </div>
        )
      }

      {
        pokemon && (
          <div className="flex flex-col gap-12">
            <div className="flex items-baseline justify-between">
              <span className="text-xl">{capitalize(name || pokemon.name)}</span>
              <span className="text-xs text-neutral-400">{pokemon.archetype}</span>
            </div>
            <div className="flex gap-6">
              {
                pokemon.types.map(type => (
                  <span
                    key={type}
                    className="rounded-md py-2 px-8 text-xs font-medium text-neutral-950"
                    style={{ backgroundColor: TYPE_COLORS[type as PokemonType] }}
                  >
                    {capitalize(type)}
                  </span>
                ))
              }
            </div>
            <div className="text-sm text-neutral-300">
              {pokemon.abilities.map(ability => abilityLabel(ability, descriptions.get(ability)?.displayName)).join(" · ")}
            </div>
            <dl className="grid grid-cols-3 gap-8 text-sm">
              <div>
                <dt className="text-xs text-neutral-500">Height</dt>
                <dd>{`${(pokemon.heightDm / 10).toFixed(1)} m`}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Weight</dt>
                <dd>{`${(pokemon.weightHg / 10).toFixed(1)} kg`}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Base exp.</dt>
                <dd>{pokemon.baseExperience}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-4">
              {
                STATS.map(stat => (
                  <div key={stat} className="grid grid-cols-[90px_36px_1fr] items-center gap-8 text-xs">
                    <span className="text-neutral-400">{STAT_LABELS[stat]}</span>
                    <span className="tabular-nums">{pokemon.stats[stat]}</span>
                    <span className="h-6 rounded-full bg-neutral-800">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(pokemon.stats[stat] / MAX_STAT) * 100}%`,
                          backgroundColor: TYPE_COLORS[pokemon.types[0] as PokemonType]
                        }}
                      />
                    </span>
                  </div>
                ))
              }
            </div>
            <details className="text-xs text-neutral-400">
              <summary className="cursor-pointer">How the model filled the rest</summary>
              <ul className="mt-6 flex flex-col gap-2">{pokemon.explain?.map(line => <li key={line}>{line}</li>)}</ul>
            </details>
          </div>
        )
      }

      <button type="button" className={button("primary")} disabled={!canSave} onClick={onSave}>Save pokemon</button>

      {
        message && (
          <div
            role="status"
            className={twMerge("flex flex-col gap-4 text-sm", message.level === "ok" ? "text-green-400" : "text-red-400")}
          >
            <span>{message.text}</span>
            {message.details?.map(detail => <span key={detail}>{`• ${detail}`}</span>)}
          </div>
        )
      }
    </section>
  )
})
