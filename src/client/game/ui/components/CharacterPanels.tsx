import type { UnitInstance } from "@game/core/types"
import { canTakeClassNow, isUniqueClassId, openClasses, unitWeapon, weaponRank } from "@game/core/units"
import { CLASS_IDS, classWeapons, fwClass, movementLabel } from "@game/content/classes"
import { CLASS_TIERS, TIER_LABELS, TIER_LEVELS, earliestLevelOf } from "@shared/character/classes"
import { SKILLS, SKILL_LABELS, rankAtLevel, skillsWith } from "@shared/character/skills"
import { Button } from "./Button"
import { BottomSheet } from "./Sheet"

const APTITUDE_MARK = { talent: "★", normal: "", weak: "▼" } as const

/** «Таланты: Sword, Flying · Слабости: Bow» — склонности персонажа модели. */
export function aptitudeLine(unit: UnitInstance): string {
  const talents = skillsWith(unit.aptitudes, "talent").map(s => SKILL_LABELS[s])
  const weak = skillsWith(unit.aptitudes, "weak").map(s => SKILL_LABELS[s])
  return `Таланты: ${talents.join(", ") || "—"}${weak.length ? ` · Слабости: ${weak.join(", ")}` : ""}`
}

/** Оружие бойца: оружие в лапах и ранг навыка, которым он им владеет. */
export function weaponLine(unit: UnitInstance): string {
  return `${unitWeapon(unit).name} · ${SKILL_LABELS[unit.weaponSkill]} ${weaponRank(unit)}`
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
              {SKILL_LABELS[s]}
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
  onPick: (classId: string) => void
}

/** Шторка смены класса: открытые классы по ярусам (оружие класса — подсказка с рангами) и ближайшие закрытые. */
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
                <b className="small muted">{TIER_LABELS[tier]}</b>
                {ids.map((id) => {
                  const blocked = takenDivine.has(id)
                  return (
                    <div key={id} className={`skill-item ${id === unit.classId ? "equipped" : ""}`}>
                      <div className="txt">
                        <div>
                          <b>{fwClass(id).name}</b>
                          {" "}
                          {id === unit.classId && <span className="chip squad">Сейчас</span>}
                        </div>
                        <div className="desc">
                          {movementLabel(id)}
                          {blocked ? " · уже у другого бойца" : ""}
                        </div>
                        <div className="desc">
                          {`Оружие класса: ${classWeapons(id)
                            .map(w => `${SKILL_LABELS[w]} ${rankAtLevel(unit.aptitudes[w], unit.level)}`)
                            .join(", ")}`}
                        </div>
                        <Button
                          sm
                          style={{ marginTop: 6 }}
                          disabled={id === unit.classId || blocked || !canTakeClassNow(unit, id)}
                          onClick={() => onPick(id)}
                        >
                          {id === unit.classId ? "Текущий" : "Выбрать"}
                        </Button>
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
                    {fwClass(id).name}
                    {" "}
                    <span className="muted">
                      ·
                      {TIER_LABELS[fwClass(id).tier]}
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
            Класс открывается, когда уровень достигает яруса (
            {CLASS_TIERS.slice(1).map(t => TIER_LEVELS[t]).join(" / ")}
            ), а ранги навыков — требований класса. Смена класса бесплатна, оружие остаётся в лапах.
          </p>
        </div>
      )}
    </BottomSheet>
  )
}
