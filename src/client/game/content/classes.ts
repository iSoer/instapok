import type { ClassDef } from "@game/core/skills/types"
import type { MoveType, WeaponKind } from "@game/core/types"
import {
  CHARACTER_CLASSES,
  TIER_LEVELS,
  classById,
  movementOf,
  weaponsOf,
  type CharacterClass,
  type ClassTier,
  type Movement
} from "@shared/character/classes"
import type { Skill, WeaponSkill } from "@shared/character/skills"

export const MOVE_NAMES: Record<MoveType, string> = {
  infantry: "Пехота",
  armor: "Броня",
  cavalry: "Кавалерия",
  flier: "Летун"
}

export const MOVE_RANGE: Record<MoveType, number> = { infantry: 2, armor: 1, cavalry: 3, flier: 2 }

export const WEAPON_KIND_NAMES: Record<WeaponKind, string> = {
  claw: "Коготь",
  fang: "Клык",
  stick: "Палка",
  hiss: "Шипение",
  howl: "Вой",
  growl: "Рык",
  slingshot: "Рогатка",
  burr: "Репейник",
  bandage: "Бинт",
  purr: "Мурчание"
}

/** Навыки модели персонажа по-русски (оружие и передвижение Fortune's Weave). */
export const SKILL_NAMES: Record<Skill, string> = {
  sword: "Меч",
  axe: "Топор",
  spear: "Копьё",
  bow: "Лук",
  gauntlet: "Кастет",
  whiteMagic: "Белая магия",
  blackMagic: "Чёрная магия",
  riding: "Верховая езда",
  flying: "Полёт",
  heavyArmor: "Тяжёлая броня"
}

export const TIER_NAMES: Record<ClassTier, string> = {
  base: "Базовый",
  beginner: "Начальный",
  specialty: "Специальный",
  advanced: "Продвинутый",
  master: "Мастер",
  divine: "Божественный"
}

/** Классы FW по-русски; ключи — id из `CHARACTER_CLASSES`. */
export const CLASS_NAMES: Record<string, string> = {
  "commoner": "Простолюдин",
  "noble": "Дворянин",
  "gladiator": "Гладиатор",
  "hunter": "Охотник",
  "soldier": "Солдат",
  "diviner": "Прорицатель",
  "myrmidon": "Мирмидон",
  "brigand": "Разбойник",
  "pugilist": "Кулачный боец",
  "archer": "Лучник",
  "rogue": "Плут",
  "armored-knight": "Латник",
  "light-cavalry": "Лёгкий кавалерист",
  "wing-soldier": "Крылатый солдат",
  "priest": "Жрец",
  "shaman": "Шаман",
  "shido": "Сидо",
  "dancer": "Танцор",
  "warrior": "Воин",
  "blacksmith": "Кузнец",
  "sniper": "Снайпер",
  "forest-knight": "Лесной рыцарь",
  "ranger": "Следопыт",
  "guardian": "Страж",
  "dreadnought": "Дредноут",
  "bardinger": "Бардингер",
  "cataphract": "Катафракт",
  "dragoon": "Драгун",
  "ovate": "Оват",
  "bishop": "Епископ",
  "troubadour": "Трубадур",
  "swordmaster": "Мастер меча",
  "high-savant": "Высший мудрец",
  "battlemaster": "Мастер боя",
  "war-monk": "Боевой монах",
  "bow-adept": "Адепт лука",
  "bow-knight": "Конный лучник",
  "shadow-seeker": "Искатель теней",
  "sentinel": "Часовой",
  "castle-knight": "Рыцарь крепости",
  "orichaldia": "Орихалдия",
  "great-knight": "Великий рыцарь",
  "celestial-trooper": "Небесный воитель",
  "bau-lord": "Повелитель бау",
  "druid": "Друид",
  "wiseman": "Мудрец",
  "valkyrium": "Валькирия",
  "the-blade": "Клинок",
  "the-apsara": "Апсара",
  "the-eternal": "Вечный",
  "the-godhand": "Длань бога",
  "the-calamity": "Бедствие",
  "the-trident": "Трезубец",
  "the-cavalier": "Кавалер",
  "the-avatar": "Аватар"
}

const MOVE_OF: Record<Movement, MoveType> = {
  infantry: "infantry",
  cavalry: "cavalry",
  flier: "flier",
  armored: "armor"
}

/** Класс-«танцор»: вместо оружия Мурчание и Поддержка «Мурлыканье». */
export const DANCER_CLASS = "dancer"
/** Классы-диверсанты стреляют Репейником вместо Рогатки. */
const BURR_CLASSES = new Set(["rogue", "shadow-seeker"])
/** Чёрная магия — три цвета звериной «магии»; цвет закрепляется за бойцом при генерации. */
export const BLACK_MAGIC_KINDS: readonly WeaponKind[] = ["hiss", "howl", "growl"]

/** Каким звериным оружием может сражаться класс навыком `weaponSkill`. */
export function weaponKindsFor(classId: string, weaponSkill: WeaponSkill): readonly WeaponKind[] {
  if (classId === DANCER_CLASS) return ["purr"]
  switch (weaponSkill) {
    case "sword":
    case "gauntlet":
      return ["claw"]
    case "spear":
      return ["fang"]
    case "axe":
      return ["stick"]
    case "bow":
      return [BURR_CLASSES.has(classId) ? "burr" : "slingshot"]
    case "blackMagic":
      return BLACK_MAGIC_KINDS
    case "whiteMagic":
      return ["bandage"]
  }
}

export function fwClass(classId: string): CharacterClass {
  const c = classById(classId)
  if (!c) throw new Error(`unknown class ${classId}`)
  return c
}

/** Оружейные навыки, которыми сражается класс (базовые классы — любым). */
export function classWeapons(classId: string): readonly WeaponSkill[] {
  return weaponsOf(fwClass(classId))
}

const CLASS_CACHE = new Map<string, ClassDef>()

/** Боевой класс: класс FW + выбранное оружие. Тип движения — из требований класса (`movementOf`). */
export function classDef(classId: string, weaponKind: WeaponKind): ClassDef {
  const key = `${classId}:${weaponKind}`
  let c = CLASS_CACHE.get(key)
  if (!c) {
    const fw = fwClass(classId)
    c = {
      id: classId,
      name: CLASS_NAMES[classId] ?? fw.name,
      tier: fw.tier,
      moveType: classMoveType(classId),
      weaponKind
    }
    CLASS_CACHE.set(key, c)
  }
  return c
}

export function classMoveType(classId: string): MoveType {
  return MOVE_OF[movementOf(fwClass(classId))]
}

export function unitClass(unit: { classId: string, weaponKind: WeaponKind }): ClassDef {
  return classDef(unit.classId, unit.weaponKind)
}

export function className(cls: ClassDef): string {
  return cls.name
}

export function tierLevel(classId: string): number {
  return TIER_LEVELS[fwClass(classId).tier]
}

export const CLASS_IDS: readonly string[] = CHARACTER_CLASSES.map(c => c.id)

export const MELEE_KINDS: readonly WeaponKind[] = ["claw", "fang", "stick", "purr"]
export const MAGIC_KINDS: readonly WeaponKind[] = ["hiss", "howl", "growl"]
export const RANGED_KINDS: readonly WeaponKind[] = ["hiss", "howl", "growl", "slingshot", "burr", "bandage"]

export function isRangedKind(k: WeaponKind): boolean {
  return RANGED_KINDS.includes(k)
}
