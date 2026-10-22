import type { Facing, Pos, Species } from "@game/core/types"

// Деревня-хаб между боями: карта клетками, домики и NPC. Логика движения — `core/village`, отрисовка — `scene/village`.

/**
 * Легенда: `T` дерево, `#` стена домика, `D` дверь, `~` пруд, `o` колодец, `b` куст — непроходимо;
 * `.` трава, `=` тропинка, `*` цветы — проходимо.
 */
export const VILLAGE_MAP: readonly string[] = [
  "TTTTTTTTTTTTTTTTTTTTTT",
  "T..*......*.......*.bT",
  "T.#####..#####..#####T",
  "T.#####..#####..#####T",
  "T.##D##..##D##..##D##T",
  "T...=......=......=..T",
  "T*..=......=......=.*T",
  "T...===============..T",
  "Tb.........=........bT",
  "T..~~~.....=.....*...T",
  "T.~~~~~..=====...b...T",
  "T..~~~...==o==.......T",
  "T........=====...*...T",
  "T.*.b.....===.....b..T",
  "T..........=.........T",
  "TTTTTTTTTTTTTTTTTTTTTT"
]

export const VILLAGE_W = 22
export const VILLAGE_H = VILLAGE_MAP.length

export type VillageTile = "tree" | "wall" | "door" | "water" | "well" | "bush" | "grass" | "path" | "flowers"

export const VILLAGE_LEGEND: Record<string, VillageTile> = {
  "T": "tree",
  "#": "wall",
  "D": "door",
  "~": "water",
  "o": "well",
  "b": "bush",
  ".": "grass",
  "=": "path",
  "*": "flowers"
}

export const WALKABLE_TILES: ReadonlySet<VillageTile> = new Set(["grass", "path", "flowers"])

export type NpcId = "barracks" | "store" | "sorties"

export interface HouseDef {
  npc: NpcId
  /** Прямоугольник стен в клетках (дверь — в середине нижнего ряда). */
  x: number
  y: number
  w: number
  h: number
  sign: string
  roof: string
  wall: string
}

export interface NpcDef {
  id: NpcId
  name: string
  /** Роль над головой. */
  title: string
  species: Species
  /** Центр NPC в клетках (дробные координаты, как у героя). */
  pos: Pos
  facing: Facing
  greeting: string
  /** Шерсть и глаза для арта (`furArt`, `eyeArt`), оружие в лапах — только украшение. */
  fur: number
  eyes: number
  accessory: number
}

export const HOUSES: readonly HouseDef[] = [
  { npc: "barracks", x: 2, y: 2, w: 5, h: 3, sign: "Казарма", roof: "#8c3b2e", wall: "#d9b48a" },
  { npc: "store", x: 9, y: 2, w: 5, h: 3, sign: "Лавка", roof: "#2f6b4f", wall: "#e3c89b" },
  { npc: "sorties", x: 16, y: 2, w: 5, h: 3, sign: "Вылазки", roof: "#3d4f86", wall: "#cfb08a" }
]

export const NPCS: readonly NpcDef[] = [
  {
    id: "barracks",
    name: "Сержант Барбос",
    title: "Армия и набор",
    species: "dog",
    pos: { x: 5.7, y: 5.6 },
    facing: "down",
    greeting: "Смирно! Кого берём в отряд, кого нанимаем?",
    fur: 4,
    eyes: 4,
    accessory: 3
  },
  {
    id: "store",
    name: "Тётушка Сырница",
    title: "Снаряжение",
    species: "mouse",
    pos: { x: 12.7, y: 5.6 },
    facing: "down",
    greeting: "Заходи, милок! Оружие, пластыри, талисманы — всё по честной цене.",
    fur: 1,
    eyes: 0,
    accessory: 6
  },
  {
    id: "sorties",
    name: "Разведчик Шрам",
    title: "Вылазки",
    species: "cat",
    pos: { x: 19.7, y: 5.6 },
    facing: "down",
    greeting: "За околицей опять неспокойно. Соберёшь отряд — покажу, где поживиться.",
    fur: 0,
    eyes: 0,
    accessory: 1
  }
]

/** Где герой появляется в новой игре и после боя (у домика Вылазок). */
export const HERO_START: Pos = { x: 11.5, y: 13.4 }
export const HERO_RETURN: Pos = { x: 18.5, y: 6.6 }

/** Скорость героя (клеток в секунду), радиусы столкновений и разговора (в клетках). */
export const HERO_SPEED = 3.4
export const HERO_RADIUS = 0.3
export const NPC_RADIUS = 0.35
export const TALK_RADIUS = 1.35
