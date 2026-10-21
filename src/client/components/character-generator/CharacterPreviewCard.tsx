import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { STATS } from "@shared/api/schema/pokemon/generated"
import type { GeneratedCharacterType } from "@shared/api/schema/character/generated"
import { CHARACTER_STAT_LABELS, MAX_LEVEL, totalOfStats } from "@shared/character/leveling"
import { TIER_LABELS, classBonusOf, classById, mountOf, movementOf, weaponsOf } from "@shared/character/classes"
import { SKILL_LABELS } from "@shared/character/skills"
import type { Issue } from "@lib/pokemon-generator/generatorState"
import { stars } from "@lib/character-generator/characterState"
import { FIELD_CLASS, capitalize } from "../pokemon-generator/typeColors"

export type CharacterPreviewState
  = | { status: "idle" }
    | { status: "loading" }
    | { status: "ok", character: GeneratedCharacterType }
    | { status: "error", error: string, violations: string[] }

export type CharacterPreviewCardPropsType = {
  preview: CharacterPreviewState
  issues: Issue[]
  name: string
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

const signed = (value: number) => (value > 0 ? `+${value}` : value === 0 ? "—" : String(value))

export const CharacterPreviewCard = memo(function CharacterPreviewCard({
  preview,
  issues,
  name,
  busy,
  canDistribute,
  message,
  onNameChange,
  onSave,
  onRandom,
  onDistribute,
  onReroll
}: CharacterPreviewCardPropsType) {
  const errors = issues.filter(issue => issue.level === "error")
  const notes = issues.filter(issue => issue.level === "info")
  const character = preview.status === "ok" ? preview.character : undefined
  const canSave = errors.length === 0 && preview.status === "ok" && !busy
  const item = character && classById(character.class)
  const bonus = item && classBonusOf(item)

  return (
    <section className="flex flex-col gap-16 rounded-lg border border-neutral-800 bg-neutral-950 p-16">
      <label className="flex flex-col gap-8">
        <span className="text-sm font-light uppercase">Name</span>
        <input
          value={name}
          maxLength={40}
          placeholder={character?.name ?? "generated from the seed"}
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
          title="Split the budget the way the model would for these talents"
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
        character && item && (
          <div className="flex flex-col gap-12">
            <div className="flex items-baseline justify-between">
              <span className="text-xl">{capitalize(name || character.name)}</span>
              <span className="text-sm text-amber-300">{stars(character.rarity)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-8 text-sm">
              <span>{`Lv ${character.level} ${item.name}`}</span>
              <span className="text-xs text-neutral-400">
                {`${TIER_LABELS[item.tier]} · ${mountOf(item) ?? movementOf(item)} · ${character.archetype}`}
              </span>
            </div>
            <div className="text-xs text-neutral-400">
              {`Weapons: ${weaponsOf(item).map(skill => `${SKILL_LABELS[skill]} ${character.ranks[skill]}`).join(" · ")}`}
            </div>
            <dl className="grid grid-cols-3 gap-8 text-sm">
              <div>
                <dt className="text-xs text-neutral-500">Height</dt>
                <dd>{`${(character.heightDm / 10).toFixed(1)} m`}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Weight</dt>
                <dd>{`${(character.weightHg / 10).toFixed(1)} kg`}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Base exp.</dt>
                <dd>{character.baseExperience}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[40px_36px_1fr_44px_64px] gap-8 text-xs text-neutral-500">
                <span>Stat</span>
                <span>{`Lv ${character.level}`}</span>
                <span className="text-right">{`BST ${totalOfStats(character.stats)}`}</span>
                <span className="text-right">Class</span>
                <span className="text-right">{`1 → ${MAX_LEVEL}`}</span>
              </div>
              {
                STATS.map(stat => (
                  <div key={stat} className="grid grid-cols-[40px_36px_1fr_44px_64px] items-center gap-8 text-xs">
                    <span className="text-neutral-400">{CHARACTER_STAT_LABELS[stat]}</span>
                    <span className="tabular-nums">{character.stats[stat]}</span>
                    <span className="h-6 rounded-full bg-neutral-800">
                      <span
                        className="block h-full rounded-full bg-blue-500"
                        style={{ width: `${(character.stats[stat] / MAX_STAT) * 100}%` }}
                      />
                    </span>
                    <span className="text-right text-neutral-500 tabular-nums">{signed(bonus![stat])}</span>
                    <span className="text-right text-neutral-500 tabular-nums">
                      {`${character.baseStats[stat]} → ${character.maxStats[stat]}`}
                    </span>
                  </div>
                ))
              }
            </div>
            <details className="text-xs text-neutral-400">
              <summary className="cursor-pointer">How the model filled the rest</summary>
              <ul className="mt-6 flex flex-col gap-2">{character.explain?.map(line => <li key={line}>{line}</li>)}</ul>
            </details>
          </div>
        )
      }

      <button type="button" className={button("primary")} disabled={!canSave} onClick={onSave}>Save character</button>

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
