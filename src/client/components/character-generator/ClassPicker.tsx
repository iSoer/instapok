import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { MAX_LEVEL, MIN_LEVEL, CHARACTER_STAT_LABELS } from "@shared/character/leveling"
import {
  CHARACTER_CLASSES, CLASS_TIERS, TIER_LABELS, TIER_LEVELS, classBonusOf, earliestLevelOf, mountOf, movementOf, weaponsOf,
  type CharacterClass
} from "@shared/character/classes"
import { SKILL_LABELS, type Aptitudes, type Rank, type Skill } from "@shared/character/skills"
import { STATS } from "@shared/api/schema/pokemon/generated"

export type ClassPickerPropsType = {
  aptitudes: Aptitudes
  level: number
  classId: string
  // Ids of the classes open at the level
  open: Set<string>
  onLevelChange: (level: number) => void
  onClassChange: (classId: string) => void
}

const requirementText = (item: CharacterClass) => {
  const list = (requirement: Partial<Record<Skill, Rank>>) => (Object.entries(requirement) as [Skill, Rank][])
    .map(([skill, rank]) => `${SKILL_LABELS[skill]} ${rank}`)
  const all = list(item.all)
  const any = list(item.any)

  return [...all, ...(any.length > 0 ? [any.join(" or ")] : [])].join(", ") || "No requirements"
}

const bonusText = (item: CharacterClass) => {
  const bonus = classBonusOf(item)

  return STATS.filter(stat => bonus[stat] !== 0)
    .map(stat => `${CHARACTER_STAT_LABELS[stat]} ${bonus[stat] > 0 ? "+" : ""}${bonus[stat]}`)
    .join(", ")
}

export const ClassPicker = memo(function ClassPicker({
  aptitudes,
  level,
  classId,
  open,
  onLevelChange,
  onClassChange
}: ClassPickerPropsType) {
  return (
    <section className="flex flex-col gap-16">
      <label className="flex flex-col gap-8">
        <span className="flex items-baseline justify-between">
          <span className="text-sm font-light uppercase">Level</span>
          <span className="text-2xl tabular-nums">{level}</span>
        </span>
        <input
          type="range"
          className="stat-range"
          min={MIN_LEVEL}
          max={MAX_LEVEL}
          step={1}
          value={level}
          style={{ background: "#404040" }}
          onChange={event => onLevelChange(Number(event.currentTarget.value))}
        />
        <span className="flex flex-wrap gap-x-12 text-xs text-neutral-400">
          {CLASS_TIERS.map(tier => <span key={tier}>{`${TIER_LABELS[tier]} ${TIER_LEVELS[tier]}+`}</span>)}
        </span>
      </label>

      {
        CLASS_TIERS.map(tier => (
          <div key={tier} className="flex flex-col gap-8">
            <span className="text-xs text-neutral-500 uppercase">
              {`${TIER_LABELS[tier]} · level ${TIER_LEVELS[tier]}+${tier === "divine" ? " · one character per class" : ""}`}
            </span>
            <div role="radiogroup" aria-label={`${TIER_LABELS[tier]} classes`} className="flex flex-wrap gap-6">
              {
                CHARACTER_CLASSES.filter(item => item.tier === tier).map((item) => {
                  const available = open.has(item.id)
                  const opensAt = available ? undefined : earliestLevelOf(item, aptitudes)
                  const lock = opensAt === undefined ? "the skills never reach it" : `opens at level ${opensAt}`

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={item.id === classId}
                      disabled={!available}
                      title={[
                        requirementText(item),
                        `${mountOf(item) ?? movementOf(item)}, ${weaponsOf(item).map(skill => SKILL_LABELS[skill]).join(", ")}`,
                        bonusText(item) && `Bonus: ${bonusText(item)}`,
                        !available && `Locked: ${lock}`
                      ].filter(Boolean).join("\n")}
                      onClick={() => onClassChange(item.id)}
                      className={twMerge(
                        "py-4 px-8 rounded-md border text-sm transition-colors",
                        "disabled:cursor-not-allowed disabled:opacity-35",
                        item.id === classId
                          ? "border-blue-400 bg-blue-500/20 text-white"
                          : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500"
                      )}
                    >
                      {item.name}
                    </button>
                  )
                })
              }
            </div>
          </div>
        ))
      }
    </section>
  )
})
