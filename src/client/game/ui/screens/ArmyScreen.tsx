import { useState } from "react"
import { useStore } from "@nanostores/react"
import type { UnitInstance } from "@game/core/types"
import { BARRACKS_CAP } from "@game/core/types"
import {
  displayName,
  hasClassUpgrade,
  learnableNow,
  skillCost,
  unitClass,
  unitClassName,
  visibleStats
} from "@game/core/units"
import { $save, ensureRoster, freeSlots } from "@game/state/save"
import { navigate } from "@game/state/router"
import { haptic } from "@game/platform/haptics"
import { Button } from "../components/Button"
import { TopBar } from "../components/TopBar"
import { ResourceBar } from "../components/ResourceBar"
import { UnitAvatar } from "../components/UnitAvatar"
import { RarityStars, WeaponBadge } from "../components/Badges"
import { ShopSheet } from "../components/ShopSheet"
import { RewardPicker } from "../components/RewardPicker"
import { useToast } from "../components/Toast"
import { MOVE_EMOJI, atkLabel } from "../lib/format"
import { stagger } from "../lib/animate"

/** Заполненный слот: краткая карточка бойца, тап — на экран бойца. */
function FilledSlot({
  unit,
  index,
  justHired,
  inSquad
}: {
  unit: UnitInstance
  index: number
  justHired: boolean
  inSquad: boolean
}) {
  const cls = unitClass(unit)
  const st = visibleStats(unit)
  const canLearn = learnableNow(unit).some(id => skillCost(id) <= unit.sp)
  return (
    <div
      className={`card slot-card filled clickable ${justHired ? "just-hired" : "pop-in"}`}
      style={stagger(index, 60)}
      onClick={() => {
        haptic("select")
        navigate(`/army/${unit.id}`)
      }}
    >
      <span className="slot-tab">
        Ур.
        {unit.level}
      </span>
      <div className="slot-head">
        <UnitAvatar unit={unit} size="md" />
        <div className="slot-meta">
          <div className="slot-name">{displayName(unit)}</div>
          <RarityStars rarity={unit.rarity} />
          <div className="muted small slot-class">
            {MOVE_EMOJI[cls.moveType]}
            {" "}
            {unitClassName(unit)}
            {" "}
            · Ур.
            {" "}
            {unit.level}
          </div>
        </div>
      </div>
      <div className="slot-foot">
        <WeaponBadge skill={cls.weaponSkill} />
        {canLearn && <span className="chip red pop">Есть навык</span>}
        {hasClassUpgrade(unit) && <span className="chip gold pop">Новый класс</span>}
        {inSquad && <span className="chip squad">В отряде</span>}
      </div>
      <div className="mini-stats">
        <span>
          HP
          {" "}
          <b>{st.hp}</b>
        </span>
        <span>
          {atkLabel(unit)}
          {" "}
          <b>{st.atk}</b>
        </span>
        <span>
          Spd
          {" "}
          <b>{st.spd}</b>
        </span>
        <span>
          Def
          {" "}
          <b>{st.def}</b>
        </span>
        <span>
          Res
          {" "}
          <b>{st.res}</b>
        </span>
      </div>
    </div>
  )
}

export function ArmyScreen() {
  const save = useStore($save)
  const [shopOpen, setShopOpen] = useState(false)
  const [justHired, setJustHired] = useState<string | null>(null)
  const [toastEl, toast] = useToast()
  const army = save.army

  const welcome = (unit: UnitInstance) => {
    setJustHired(unit.id)
    toast(`${displayName(unit)} в ростере!`)
    window.setTimeout(() => setJustHired(cur => (cur === unit.id ? null : cur)), 900)
  }

  if (!army || army.units.length === 0) {
    return (
      <div className="screen">
        <TopBar title="Ростер" right={<ResourceBar />} onBack={() => navigate("/", true)} />
        <div className="screen-body">
          <div className="empty">
            <div className="big">🪦</div>
            <h3>Казарма пуста</h3>
            <p>Все пали или никого ещё нет. Новый ростер выдаётся сразу; Слава остаётся с вами.</p>
            <Button primary big icon="🐾" onClick={() => ensureRoster()}>
              Набрать новый ростер
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Сначала отряд, затем остальные по уровню
  const squad = new Set(army.squadIds)
  const units = [...army.units].sort((a, b) => Number(squad.has(b.id)) - Number(squad.has(a.id)) || b.level - a.level)

  return (
    <div className="screen">
      <TopBar title="Ростер" right={<ResourceBar />} onBack={() => navigate("/", true)} />
      <div className="screen-body">
        <RewardPicker toast={toast} onClaimed={welcome} />
        <div className="row between">
          <span className="muted small">
            Персонажей:
            {" "}
            <b>{army.units.length}</b>
            /
            {BARRACKS_CAP}
          </span>
          <span className="muted small">Отряд на бой выбирается при подготовке</span>
        </div>
        <div className="slot-grid">
          {units.map((u, i) => (
            <FilledSlot key={u.id} unit={u} index={i} justHired={justHired === u.id} inSquad={squad.has(u.id)} />
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Button
            block
            icon="🛒"
            onClick={() => {
              haptic("select")
              setShopOpen(true)
            }}
          >
            {`Магазин (${save.shelter.candidates.length})`}
          </Button>
          <Button block icon="⚔️" onClick={() => navigate("/battle/setup")} primary>
            К бою
          </Button>
        </div>
        {freeSlots(save) === 0 && (
          <p className="muted small hint-line">Ростер полон: чтобы взять новых, кого-то придётся отпустить.</p>
        )}
      </div>
      <ShopSheet open={shopOpen} onClose={() => setShopOpen(false)} toast={toast} onBought={welcome} />
      {toastEl}
    </div>
  )
}
