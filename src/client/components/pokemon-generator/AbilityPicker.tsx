import { memo, useMemo, useState } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { STATS, type PokemonType } from "@shared/api/schema/pokemon/generated"
import {
  MAX_ABILITIES, abilityPool, type GeneratorModel, type ModelAbility, type StatLimits
} from "@lib/pokemon-generator/generatorState"
import { FIELD_CLASS, STAT_LABELS, TYPE_COLORS, abilityLabel, capitalize } from "./typeColors"

export type AbilityDescription = { displayName: string | null, shortEffect: string | null }

export type AbilityPickerPropsType = {
  model: GeneratorModel
  types: PokemonType[]
  selected: string[]
  // Ability counts the class allows; picking stops at the largest
  allowedCounts: number[]
  limits: StatLimits
  descriptions: Map<string, AbilityDescription>
  onToggle: (ability: string) => void
}

// Shifts smaller than this (share of BST) are not worth a hint
const MIN_SHIFT_HINT = 0.02

const slotLabels = (count: number) => (count === 3 ? ["Slot 1", "Slot 2", "Hidden"] : ["Slot 1", "Slot 2 / hidden", "Hidden"])

/** "Defense +6.1 pp, Speed −4.2 pp": how carriers of the ability spend their budget, beyond what their type explains */
const shiftHint = (ability: ModelAbility) => {
  if (!ability.shift) {
    return undefined
  }

  const parts = STATS
    .map(stat => ({ stat, value: ability.shift![stat] }))
    .filter(({ value }) => Math.abs(value) >= MIN_SHIFT_HINT)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 2)
    .map(({ stat, value }) => `${STAT_LABELS[stat]} ${value > 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)} pp`)

  return parts.length > 0 ? parts.join(", ") : undefined
}

export const AbilityPicker = memo(function AbilityPicker({
  model,
  types,
  selected,
  allowedCounts,
  limits,
  descriptions,
  onToggle
}: AbilityPickerPropsType) {
  const [search, setSearch] = useState("")
  const pool = useMemo(() => abilityPool(model, types), [model, types])
  const byName = useMemo(() => new Map(model.abilities.map(ability => [ability.name, ability])), [model])
  const maxCount = Math.min(MAX_ABILITIES, Math.max(...allowedCounts, 1))
  const full = selected.length >= maxCount
  const query = search.trim().toLowerCase()

  const matches = (ability: ModelAbility) => query === ""
    || ability.name.includes(query)
    || (descriptions.get(ability.name)?.displayName ?? "").toLowerCase().includes(query)

  const chip = (ability: ModelAbility, type?: PokemonType) => {
    const active = selected.includes(ability.name)
    const strong = model.compensation[ability.name]
    const description = descriptions.get(ability.name)

    return (
      <button
        key={ability.name}
        type="button"
        aria-pressed={active}
        disabled={!active && full}
        title={[description?.shortEffect, strong && `Strong: ${strong.note}`].filter(Boolean).join("\n")}
        onClick={() => onToggle(ability.name)}
        className={twMerge(
          "flex items-center gap-6 py-4 px-8 rounded-md",
          "text-sm border transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-40",
          active
            ? "border-blue-400 bg-blue-500/20 text-white"
            : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500",
          strong && !active && "border-amber-500/60"
        )}
      >
        {strong && <span aria-label="strong ability">⚡</span>}
        {abilityLabel(ability.name, description?.displayName)}
        <span className="text-xs text-neutral-500">{type ? ability.types[type] : ability.count}</span>
      </button>
    )
  }

  const labels = slotLabels(selected.length)

  return (
    <fieldset className="flex flex-col gap-12">
      <legend className="mb-8 text-sm font-light uppercase">
        {`Abilities (${selected.length}/${maxCount})`}
      </legend>

      {
        selected.length > 0 && (
          <ol className="flex flex-col gap-6">
            {
              selected.map((name, i) => {
                const ability = byName.get(name)
                const rule = model.compensation[name]
                const hint = ability && shiftHint(ability)
                const capped = STATS.filter(stat => limits[stat].reason === name)
                const effect = descriptions.get(name)?.shortEffect
                const limitText = capped
                  .map(stat => `; ${STAT_LABELS[stat]} ${limits[stat].locked ? "fixed at" : "max"} ${limits[stat].max}`)
                  .join("")

                return (
                  <li key={name} className="flex flex-col gap-2 rounded-md bg-neutral-900 py-6 px-8">
                    <div className="flex items-center justify-between gap-8">
                      <span>
                        <span className="text-xs text-neutral-500">{`${labels[i]} · `}</span>
                        {abilityLabel(name, descriptions.get(name)?.displayName)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${name}`}
                        onClick={() => onToggle(name)}
                        className="text-neutral-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    {effect && <span className="text-xs text-neutral-400">{effect}</span>}
                    {
                      rule && (
                        <span className="text-xs text-amber-300">
                          {`⚡ ${rule.note}`}
                          {limitText}
                        </span>
                      )
                    }
                    {
                      hint && (
                        <span className="text-xs text-sky-300">{`Carriers lean to ${hint} (used by “Distribute by model”)`}</span>
                      )
                    }
                  </li>
                )
              })
            }
          </ol>
        )
      }

      {
        types.length === 0
          ? <div className="text-sm text-neutral-400">Pick a type to see the abilities pokemon of that type have</div>
          : (
              <>
                <input
                  type="search"
                  placeholder="Search abilities"
                  value={search}
                  onChange={event => setSearch(event.currentTarget.value)}
                  className={FIELD_CLASS}
                />
                {
                  pool.byType.map(({ type, abilities }) => (
                    <div key={type} className="flex flex-col gap-6">
                      <div className="flex items-center gap-6 text-xs uppercase text-neutral-400">
                        <span className="h-8 w-8 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
                        {`${capitalize(type)} · carriers of this type`}
                      </div>
                      <div className="flex flex-wrap gap-6">{abilities.filter(matches).map(ability => chip(ability, type))}</div>
                    </div>
                  ))
                }
                <div className="flex flex-col gap-6">
                  <div className="text-xs uppercase text-neutral-400">Universal · any type</div>
                  <div className="flex flex-wrap gap-6">{pool.universal.filter(matches).map(ability => chip(ability))}</div>
                </div>
              </>
            )
      }
    </fieldset>
  )
})
