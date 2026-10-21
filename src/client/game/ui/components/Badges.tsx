import type { Rarity, WeaponSkill } from "@game/core/types"
import { WEAPON_COLOR } from "@game/content/weapons"
import { classMoveType, movementLabel } from "@game/content/classes"
import { SKILL_LABELS } from "@shared/character/skills"
import { COLOR_CSS, MOVE_EMOJI } from "../lib/format"

/** Оружейный навык модели (`SKILL_LABELS`) с цветом треугольника. */
export function WeaponBadge({ skill, name }: { skill: WeaponSkill, name?: string }) {
  return (
    <span className="badge">
      <span className="dot" style={{ background: COLOR_CSS[WEAPON_COLOR[skill]] }} />
      {name ?? SKILL_LABELS[skill]}
    </span>
  )
}

/** Передвижение класса так, как его показывает модель: животное (`mountOf`) или тип движения. */
export function MoveBadge({ classId }: { classId: string }) {
  return (
    <span className="badge">
      {MOVE_EMOJI[classMoveType(classId)]}
      {" "}
      {movementLabel(classId)}
    </span>
  )
}

export function RarityStars({ rarity }: { rarity: Rarity }) {
  return (
    <span className="stars" aria-label={`Редкость ${rarity}`}>
      {"★".repeat(rarity)}
      <span style={{ opacity: 0.25 }}>{"★".repeat(5 - rarity)}</span>
    </span>
  )
}
