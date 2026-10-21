import type { ClassDef } from "@game/core/skills/types"
import type { MoveType, WeaponSkill } from "@game/core/types"
import {
  CHARACTER_CLASSES,
  TIER_LEVELS,
  classById,
  mountOf,
  movementOf,
  weaponsOf,
  type CharacterClass
} from "@shared/character/classes"
import { isMagicWeapon, weaponRange } from "./weapons"

// Классы, их тип движения и оружие — модель персонажа (`src/shared/character/classes.ts`); здесь только поиск
// и боевой класс для ядра. Названия — `CharacterClass.name`, ярусы — `TIER_LABELS`, навыки — `SKILL_LABELS`.

/** Клеток хода по типу движения модели (правило игры, как в FEH). */
export const MOVE_RANGE: Record<MoveType, number> = { infantry: 2, armored: 1, cavalry: 3, flier: 2 }

/** Класс Dancer: танцует (Поддержка «освежить» союзника) вместо обычной Поддержки. */
export const DANCER_CLASS = "dancer"

export function fwClass(classId: string): CharacterClass {
  const c = classById(classId)
  if (!c) throw new Error(`unknown class ${classId}`)
  return c
}

/** Оружейные навыки, которыми сражается класс (`weaponsOf`; базовые классы — любым). */
export function classWeapons(classId: string): readonly WeaponSkill[] {
  return weaponsOf(fwClass(classId))
}

export function classMoveType(classId: string): MoveType {
  return movementOf(fwClass(classId))
}

/** Как модель показывает передвижение класса: животное (`mountOf`), иначе тип движения. */
export function movementLabel(classId: string): string {
  const fw = fwClass(classId)
  return mountOf(fw) ?? movementOf(fw)
}

const CLASS_CACHE = new Map<string, ClassDef>()

/** Боевой класс: класс модели + оружейный навык, которым боец сражается. */
export function classDef(classId: string, weaponSkill: WeaponSkill): ClassDef {
  const key = `${classId}:${weaponSkill}`
  let c = CLASS_CACHE.get(key)
  if (!c) {
    const fw = fwClass(classId)
    c = { id: classId, name: fw.name, tier: fw.tier, moveType: movementOf(fw), weaponSkill }
    CLASS_CACHE.set(key, c)
  }
  return c
}

export function unitClass(unit: { classId: string, weaponSkill: WeaponSkill }): ClassDef {
  return classDef(unit.classId, unit.weaponSkill)
}

export function className(cls: ClassDef): string {
  return cls.name
}

export function tierLevel(classId: string): number {
  return TIER_LEVELS[fwClass(classId).tier]
}

export const CLASS_IDS: readonly string[] = CHARACTER_CLASSES.map(c => c.id)

export function isRangedWeapon(skill: WeaponSkill): boolean {
  return weaponRange(skill) === 2
}

export { isMagicWeapon }
