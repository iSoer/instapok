import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import {
  MAX_TALENTS, MAX_WEAKNESSES, MOVEMENT_SKILLS, SKILL_LABELS, WEAPON_SKILLS, type Aptitude, type Ranks, type Skill
} from "@shared/character/skills"

export type SkillPickerPropsType = {
  aptitudeOf: (skill: Skill) => Aptitude
  // Ranks at the current level
  ranks: Ranks
  level: number
  talents: number
  weaknesses: number
  onCycle: (skill: Skill) => void
}

const APTITUDE_LABELS: Record<Aptitude, string> = { talent: "Talent", normal: "Normal", weak: "Weak" }

const APTITUDE_CLASSES: Record<Aptitude, string> = {
  talent: "border-amber-400 bg-amber-500/20 text-amber-200",
  normal: "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500",
  weak: "border-red-500/60 bg-red-500/10 text-red-300"
}

export const SkillPicker = memo(function SkillPicker({
  aptitudeOf,
  ranks,
  level,
  talents,
  weaknesses,
  onCycle
}: SkillPickerPropsType) {
  const group = (title: string, skills: readonly Skill[]) => (
    <div className="flex flex-col gap-8">
      <span className="text-xs text-neutral-500 uppercase">{title}</span>
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
        {
          skills.map((skill) => {
            const aptitude = aptitudeOf(skill)

            return (
              <button
                key={skill}
                type="button"
                title="Click: normal → talent → weak"
                aria-label={`${SKILL_LABELS[skill]}: ${APTITUDE_LABELS[aptitude]}, rank ${ranks[skill]}`}
                onClick={() => onCycle(skill)}
                className={twMerge(
                  "flex items-center justify-between gap-6 py-6 px-8 rounded-md border text-sm transition-colors",
                  APTITUDE_CLASSES[aptitude]
                )}
              >
                <span className="flex flex-col items-start">
                  <span>{SKILL_LABELS[skill]}</span>
                  <span className="text-xs opacity-70">{APTITUDE_LABELS[aptitude]}</span>
                </span>
                <span className="text-lg tabular-nums">{ranks[skill]}</span>
              </button>
            )
          })
        }
      </div>
    </div>
  )

  return (
    <fieldset className="flex flex-col gap-12">
      <legend className="mb-8 text-sm font-light uppercase">
        {`Skills: talents ${talents}/${MAX_TALENTS}, weaknesses ${weaknesses}/${MAX_WEAKNESSES} · ranks at level ${level}`}
      </legend>
      {group("Weapons", WEAPON_SKILLS)}
      {group("Movement", MOVEMENT_SKILLS)}
    </fieldset>
  )
})
