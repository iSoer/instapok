import type { WeaponDef, WeaponVariant } from "@game/core/skills/types"
import type { Color } from "@game/core/types"
import { CHARACTER_STAT_LABELS } from "@shared/character/leveling"
import { SKILL_LABELS, WEAPON_SKILLS, type WeaponSkill } from "@shared/character/skills"

// Оружие игры — оружейные навыки модели персонажа (`WEAPON_SKILLS`), названия — `SKILL_LABELS`.
// Цвет треугольника, дальность, Mt и разновидности — боевые правила игры поверх модели.

/** Треугольник FEH: Sword бьёт Axe, Axe бьёт Spear, Spear бьёт Sword; остальное бесцветное. */
export const WEAPON_COLOR: Record<WeaponSkill, Color> = {
  sword: "red",
  spear: "blue",
  axe: "green",
  gauntlet: "colorless",
  bow: "colorless",
  blackMagic: "colorless",
  whiteMagic: "colorless"
}

interface WeaponSpec {
  range: 1 | 2
  mt: number
  /** Бьёт по Res, атака от Mag. */
  magical: boolean
  /** Посох: урон ×0.5, лечит через Поддержку. */
  isStaff: boolean
  variants: readonly WeaponVariant[]
  effectiveAgainst?: WeaponDef["effectiveAgainst"]
  desc: string
}

const MELEE_VARIANTS: readonly WeaponVariant[] = ["basic", "brave", "killer", "armorslayer", "cavslayer"]

const SPECS: Record<WeaponSkill, WeaponSpec> = {
  sword: { range: 1, mt: 6, magical: false, isStaff: false, variants: MELEE_VARIANTS, desc: "Ближний бой, красный." },
  spear: { range: 1, mt: 6, magical: false, isStaff: false, variants: MELEE_VARIANTS, desc: "Ближний бой, синий." },
  axe: { range: 1, mt: 6, magical: false, isStaff: false, variants: MELEE_VARIANTS, desc: "Ближний бой, зелёный." },
  gauntlet: {
    range: 1,
    mt: 5,
    magical: false,
    isStaff: false,
    variants: ["basic", "brave", "killer"],
    desc: "Ближний бой, бесцветный."
  },
  bow: {
    range: 2,
    mt: 5,
    magical: false,
    isStaff: false,
    variants: ["basic", "brave", "killer"],
    effectiveAgainst: ["flier"],
    desc: "Дальний бой, бесцветный. Эффективен против flier."
  },
  blackMagic: {
    range: 2,
    mt: 5,
    magical: true,
    isStaff: false,
    variants: ["basic", "killer"],
    desc: `Магия с 2 клеток: атака от ${CHARACTER_STAT_LABELS.specialAttack}, бьёт по ${CHARACTER_STAT_LABELS.specialDefense}.`
  },
  whiteMagic: {
    range: 2,
    mt: 4,
    magical: true,
    isStaff: true,
    variants: ["basic", "killer"],
    desc: "Лечит через Поддержку. Урон ×0.5."
  }
}

/** Название разновидности: базовое оружие — название навыка модели, остальные — с приставкой. */
const VARIANT_PREFIX: Record<WeaponVariant, string> = {
  basic: "",
  brave: "Brave ",
  killer: "Killer ",
  armorslayer: "Armorslayer ",
  cavslayer: "Horseslayer "
}

const SPD = CHARACTER_STAT_LABELS.speed

function build(): WeaponDef[] {
  const out: WeaponDef[] = []
  for (const skill of WEAPON_SKILLS) {
    const spec = SPECS[skill]
    for (const variant of spec.variants) {
      const w: WeaponDef = {
        id: `${skill}_${variant}`,
        name: `${VARIANT_PREFIX[variant]}${SKILL_LABELS[skill]}`,
        kind: skill,
        color: WEAPON_COLOR[skill],
        range: spec.range,
        mt: spec.mt,
        variant,
        magical: spec.magical,
        isStaff: spec.isStaff,
        spCost: variant === "basic" ? 0 : 300,
        desc: spec.desc
      }
      if (spec.effectiveAgainst) w.effectiveAgainst = spec.effectiveAgainst
      switch (variant) {
        case "brave":
          w.mt -= 2
          w.spdMod = -5
          w.desc += ` Две атаки подряд при инициативе, −5 ${SPD}.`
          break
        case "killer":
          w.mt -= 1
          w.cdMod = -1
          w.desc += " Кулдаун спецприёма −1."
          break
        case "armorslayer":
          w.effectiveAgainst = ["armored"]
          w.desc += " Эффективно против armored."
          break
        case "cavslayer":
          w.effectiveAgainst = ["cavalry"]
          w.desc += " Эффективно против cavalry."
          break
        default:
          break
      }
      out.push(w)
    }
  }
  return out
}

export const WEAPONS: readonly WeaponDef[] = build()
const WEAPON_MAP = new Map(WEAPONS.map(w => [w.id, w]))

export function weaponDef(id: string): WeaponDef {
  const w = WEAPON_MAP.get(id)
  if (!w) throw new Error(`unknown weapon ${id}`)
  return w
}

export function basicWeaponId(skill: WeaponSkill): string {
  return `${skill}_basic`
}

export function weaponsForSkill(skill: WeaponSkill): WeaponDef[] {
  return WEAPONS.filter(w => w.kind === skill)
}

export function isMagicWeapon(skill: WeaponSkill): boolean {
  return SPECS[skill].magical
}

export function weaponRange(skill: WeaponSkill): 1 | 2 {
  return SPECS[skill].range
}
