import type { UnitInstance } from "@game/core/types"
import { canTakeClassNow, isUniqueClassId, kindAfterReclass, openClasses, weaponRank } from "@game/core/units"
import {
  CLASS_IDS,
  CLASS_NAMES,
  MOVE_NAMES,
  SKILL_NAMES,
  TIER_NAMES,
  WEAPON_KIND_NAMES,
  classMoveType,
  classWeapons,
  fwClass
} from "@game/content/classes"
import { CLASS_TIERS, earliestLevelOf } from "@shared/character/classes"
import { SKILLS, rankAtLevel, skillsWith, type WeaponSkill } from "@shared/character/skills"
import { Button } from "./Button"
import { BottomSheet } from "./Sheet"

const APTITUDE_MARK = { talent: "★", normal: "", weak: "▼" } as const

/** «Таланты: Меч, Полёт · Слабости: Лук» — склонности персонажа модели. */
export function aptitudeLine(unit: UnitInstance): string {
  const talents = skillsWith(unit.aptitudes, "talent").map(s => SKILL_NAMES[s])
  const weak = skillsWith(unit.aptitudes, "weak").map(s => SKILL_NAMES[s])
  return `Таланты: ${talents.join(", ") || "—"}${weak.length ? ` · Слабости: ${weak.join(", ")}` : ""}`
}

/** Оружие бойца: навык FW, его ранг и звериное оружие. */
export function weaponLine(unit: UnitInstance): string {
  return `${SKILL_NAMES[unit.weaponSkill]} ${weaponRank(unit)} → ${WEAPON_KIND_NAMES[unit.weaponKind]}`
}

/** Ранги всех навыков на уровне бойца; ★ — талант, ▼ — слабость. */
export function SkillRanks({ unit }: { unit: UnitInstance }) {
  return (
    <div className="rank-grid">
      {SKILLS.map((s) => {
        const aptitude = unit.aptitudes[s]
        return (
          <div key={s} className={`rank-cell ${aptitude} ${s === unit.weaponSkill ? "current" : ""}`}>
            <span className="rank-name">
              {APTITUDE_MARK[aptitude]}
              {SKILL_NAMES[s]}
            </span>
            <b className="rank-value">{rankAtLevel(aptitude, unit.level)}</b>
          </div>
        )
      })}
    </div>
  )
}

interface ClassSheetProps {
  unit: UnitInstance
  /** Бойцы армии: божественный класс может быть только у одного. */
  army: UnitInstance[]
  open: boolean
  onClose: () => void
  onPick: (classId: string, weaponSkill: WeaponSkill) => void
}

/** Шторка смены класса: открытые классы по ярусам с выбором оружия и ближайшие закрытые. */
export function ClassSheet({ unit, army, open, onClose, onPick }: ClassSheetProps) {
  const opened = new Set(open ? openClasses(unit) : [])
  const takenDivine = new Set(army.filter(u => u.id !== unit.id && isUniqueClassId(u.classId)).map(u => u.classId))
  const upcoming = open
    ? CLASS_IDS.filter(id => !opened.has(id))
        .map(id => ({ id, level: earliestLevelOf(fwClass(id), unit.aptitudes) }))
        .filter((x): x is { id: string, level: number } => x.level !== undefined)
        .sort((a, b) => a.level - b.level)
        .slice(0, 6)
    : []
  return (
    <BottomSheet open={open} onClose={onClose} title="🎓 Класс">
      {open && (
        <div className="stack">
          {CLASS_TIERS.map((tier) => {
            const ids = CLASS_IDS.filter(id => opened.has(id) && fwClass(id).tier === tier)
            if (ids.length === 0) return null
            return (
              <div key={tier} className="stack" style={{ gap: 6 }}>
                <b className="small muted">{TIER_NAMES[tier]}</b>
                {ids.map((id) => {
                  const blocked = takenDivine.has(id)
                  return (
                    <div key={id} className={`skill-item ${id === unit.classId ? "equipped" : ""}`}>
                      <div className="txt">
                        <div>
                          <b>{CLASS_NAMES[id]}</b>
                          {" "}
                          {id === unit.classId && <span className="chip squad">Сейчас</span>}
                        </div>
                        <div className="desc">
                          {MOVE_NAMES[classMoveType(id)]}
                          {blocked ? " · уже у другого бойца" : ""}
                        </div>
                        <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                          {classWeapons(id).map((w) => {
                            const current = id === unit.classId && w === unit.weaponSkill
                            const kind = kindAfterReclass(unit, id, w)
                            return (
                              <Button
                                key={w}
                                sm
                                disabled={current || blocked || !canTakeClassNow(unit, id)}
                                onClick={() => onPick(id, w)}
                              >
                                {SKILL_NAMES[w]}
                                {" "}
                                {rankAtLevel(unit.aptitudes[w], unit.level)}
                                {" "}
                                ·
                                {" "}
                                {WEAPON_KIND_NAMES[kind]}
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {upcoming.length > 0 && (
            <div className="stack" style={{ gap: 4 }}>
              <b className="small muted">Откроются позже</b>
              {upcoming.map(({ id, level }) => (
                <div key={id} className="row between small">
                  <span>
                    {CLASS_NAMES[id]}
                    {" "}
                    <span className="muted">
                      ·
                      {TIER_NAMES[fwClass(id).tier]}
                    </span>
                  </span>
                  <span className="muted">
                    с
                    {level}
                    {" "}
                    ур.
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="muted small">
            Класс открывается, когда уровень достигает яруса (5 / 20 / 35 / 45 / 60), а ранги навыков — требований
            класса. Смена класса бесплатна; при смене оружия экипировано базовое.
          </p>
        </div>
      )}
    </BottomSheet>
  )
}
