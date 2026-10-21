import { describe, expect, it } from "vitest"
import {
  artWeapon,
  backdropSvg,
  critterSvg,
  tileSvg,
  unitSvg,
  unitPartSvg,
  unitArtKey,
  furArt,
  eyeArt,
  CRITTER_PARTS,
  type CritterArt,
  type Pose
} from "@game/art/index"
import { BIOMES } from "@game/content/biomes"
import { CLASS_IDS, classDef, classWeapons } from "@game/content/classes"

const CLASSES = CLASS_IDS.flatMap(id => classWeapons(id).map(w => classDef(id, w)))
import { generateUnit } from "@game/core/units"
import type { TerrainId } from "@game/core/types"

const TERRAINS: TerrainId[] = ["plain", "forest", "mountain", "water", "wall", "wall_breakable", "cover"]
const POSES: Pose[] = ["idle", "run", "hurt", "dead", "happy", "carried", "blink"]

function wellFormed(svg: string): void {
  expect(svg.startsWith("<svg")).toBe(true)
  expect(svg.trimEnd().endsWith("</svg>")).toBe(true)
  expect(svg).not.toMatch(/NaN|undefined|null/)
  // парные теги g
  const open = (svg.match(/<g\b/g) ?? []).length
  const close = (svg.match(/<\/g>/g) ?? []).length
  expect(open).toBe(close)
}

describe("арт: миниатюры", () => {
  it("все виды × позы × снаряжение дают корректный SVG", () => {
    for (const species of ["cat", "dog", "mouse"] as const) {
      for (const pose of POSES) {
        for (const [i, cls] of CLASSES.entries()) {
          const a: CritterArt = {
            species,
            fur: furArt(i),
            iris: eyeArt(1),
            pattern: i % 4,
            eyes: i % 6,
            accessory: i % 8,
            moveType: cls.moveType,
            weapon: artWeapon(cls.weaponSkill),
            weaponColor: "#e63946",
            pose,
            boss: pose === "happy",
            angry: pose === "run"
          }
          wellFormed(critterSvg(a))
        }
      }
    }
  })
  it("animated-вариант содержит CSS-хуки", () => {
    const svg = critterSvg({
      species: "cat",
      fur: furArt(0),
      iris: eyeArt(0),
      pattern: 0,
      eyes: 0,
      accessory: 0,
      animated: true,
      blinkDelay: -1.5
    })
    for (const cls of [
      "class=\"tail\"",
      "class=\"legs\"",
      "leg-front",
      "leg-back",
      "class=\"head\"",
      "ear-l",
      "class=\"eyes-open\"",
      "class=\"eyes-happy\""
    ])
      expect(svg).toContain(cls)
    expect(svg).toContain("animation-delay:-1.50s")
  })
  it("части тела для разлёта — корректный SVG для всех видов и классов", () => {
    for (let i = 0; i < 24; i++) {
      const cls = CLASSES[(i * 7) % CLASSES.length]!
      const u = { ...generateUnit({ seed: 5000 + i, level: 3 }), classId: cls.id, weaponSkill: cls.weaponSkill }
      for (const part of CRITTER_PARTS) wellFormed(unitPartSvg(u, part))
    }
  })
  it("unitSvg работает для сгенерированных бойцов, ключ стабилен", () => {
    for (let i = 0; i < 40; i++) {
      const u = generateUnit({ seed: 1000 + i, level: 5, isEnemy: i % 2 === 0, isBoss: i % 7 === 0 })
      wellFormed(unitSvg(u, { pose: POSES[i % POSES.length] }))
      expect(unitArtKey(u, "idle")).toBe(unitArtKey({ ...u }, "idle"))
    }
  })
})

describe("арт: фоны и тайлы", () => {
  it("фоны для всех биомов, клеток и сторон", () => {
    for (const b of BIOMES)
      for (const t of TERRAINS) for (const side of ["left", "right"] as const) wellFormed(backdropSvg(b.id, t, side))
  })
  it("тайлы для всех биомов, клеток и кадров анимации", () => {
    for (const b of BIOMES) for (const t of TERRAINS) for (const f of [0, 1, 2]) wellFormed(tileSvg(b.id, t, f))
    // кадры воды действительно различаются
    expect(tileSvg("yard", "water", 0)).not.toBe(tileSvg("yard", "water", 1))
    expect(tileSvg("jungle", "forest", 0)).not.toBe(tileSvg("jungle", "forest", 1))
  })
})
