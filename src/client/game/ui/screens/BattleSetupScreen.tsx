import { useEffect, useState } from "react"
import { useStore } from "@nanostores/react"
import type { Difficulty, Stance, UnitInstance } from "@game/core/types"
import { SQUAD_SIZE } from "@game/core/types"
import { visibleStats } from "@game/core/units"
import { DIFFICULTIES } from "@game/content/balance"
import { biomeDef } from "@game/content/biomes"
import {
  $save,
  $unlockedBiomes,
  difficultyUnlocked,
  ensureRoster,
  scoutBattle,
  startBattle,
  toggleSquad
} from "@game/state/save"
import { navigate } from "@game/state/router"
import { Button } from "../components/Button"
import { TopBar } from "../components/TopBar"
import { ResourceBar } from "../components/ResourceBar"
import { UnitRow } from "../components/UnitRow"
import { useToast } from "../components/Toast"
import { statTotal } from "../lib/format"
import { stagger } from "../lib/animate"
import { haptic } from "@game/platform/haptics"

const DIFF_STYLE: Record<Difficulty, { icon: string, color: string, rgb: string }> = {
  easy: { icon: "🌱", color: "#9ad66b", rgb: "154, 214, 107" },
  normal: { icon: "⚔️", color: "#8fc9ff", rgb: "143, 201, 255" },
  hard: { icon: "🔥", color: "#ffb86b", rgb: "255, 184, 107" },
  nightmare: { icon: "💀", color: "#ff5a68", rgb: "255, 90, 104" }
}
const STANCE_LABEL: Record<Stance, string> = { hold: "ждёт", advance: "наступает", guard: "охраняет" }

const power = (units: UnitInstance[]): number => units.reduce((a, u) => a + statTotal(visibleStats(u)), 0)

const BIOME_ICON: Record<string, string> = { yard: "🏡", roofs: "🏙️", basement: "🕯️", dump: "🗑️", winter_park: "❄️" }

export function BattleSetupScreen() {
  const save = useStore($save)
  const biomes = useStore($unlockedBiomes)
  const army = save.army
  const pending = save.pendingBattle
  const [difficulty, setDifficulty] = useState<Difficulty>(pending?.difficulty ?? "easy")
  const [biome, setBiome] = useState<string>(pending?.biomeId ?? "random")
  const [toastEl, toast] = useToast()

  useEffect(() => {
    ensureRoster()
  }, [])
  // Разведка: враги известны до выбора отряда; seed закреплён, пока бой не начат
  useEffect(() => {
    if (army) scoutBattle(difficulty, biome)
  }, [army, difficulty, biome])

  if (!army) return <div className="screen" />

  const squadIds = army.squadIds.filter(id => army.units.some(u => u.id === id))
  const squad = squadIds.map(id => army.units.find(u => u.id === id)).filter((u): u is UnitInstance => !!u)
  const map = pending && pending.difficulty === difficulty && pending.biomeId === biome ? pending.map : undefined
  const enemies = map?.enemies ?? []
  const waves = map?.reinforcements ?? []
  const enemyPower = power([...enemies.map(e => e.unit), ...waves.flatMap(w => w.units.map(x => x.unit))])
  const squadPower = power(squad)
  const ratio = enemyPower > 0 ? squadPower / enemyPower : 1
  const ratioLabel
    = ratio >= 1.1 ? "Преимущество у вас" : ratio >= 0.85 ? "Силы равны" : ratio >= 0.6 ? "Будет тяжело" : "Самоубийство"
  const ratioClass = ratio >= 1.0 ? "ok" : ratio >= 0.75 ? "warn" : "danger"
  const barClass = ratio >= 1.0 ? "good" : ratio >= 0.75 ? "mid" : "bad"
  const roster = [...army.units].sort((a, b) => b.level - a.level)

  const onToggle = (id: string) => {
    const r = toggleSquad(id)
    if (!r.ok) return toast(r.error ?? "Ошибка", true)
    haptic("select")
  }
  const onStart = () => {
    if (squad.length === 0) return toast("Выберите бойцов в отряд", true)
    const r = startBattle(squadIds)
    if (!r.ok) return toast(r.error ?? "Ошибка", true)
    haptic("heavy")
    navigate("/battle", true)
  }

  return (
    <div className="screen">
      <TopBar title="Подготовка к бою" right={<ResourceBar />} onBack={() => navigate("/", true)} />
      <div className="screen-body">
        <div className="section-title">Сложность</div>
        <div className="stack">
          {DIFFICULTIES.map((d, i) => {
            const unlocked = difficultyUnlocked(save, d.id)
            const st = DIFF_STYLE[d.id]
            const rules: string[] = []
            if (d.reinforcements.length)
              rules.push(`подкрепления (ход ${d.reinforcements.map(r => r.turn).join(", ")})`)
            if (d.boss) rules.push("вожак")
            if (d.objective === "killBoss") rules.push("цель: убить вожака")
            const unlockText = d.unlock
              ? `после ${d.unlock.wins} побед на «${DIFFICULTIES.find(x => x.id === d.unlock?.difficulty)?.name}»`
              : ""
            return (
              <div
                key={d.id}
                className={`card clickable diff-card pop-in ${difficulty === d.id ? "selected" : ""} ${unlocked ? "" : "locked"}`}
                style={{ ...stagger(i, 60), "--diff-color": st.color, "--diff-rgb": st.rgb } as Record<string, string>}
                onClick={() => {
                  if (!unlocked) return toast(`Откроется ${unlockText}`)
                  haptic("select")
                  setDifficulty(d.id)
                }}
              >
                <span className="diff-ico" aria-hidden="true">
                  {unlocked ? st.icon : "🔒"}
                </span>
                <div className="diff-body">
                  <b>{d.name}</b>
                  <div className="muted small">{unlocked ? d.desc : `Закрыто: ${unlockText}`}</div>
                  <div className="diff-meta">
                    <span className="chip">{`🦴 ×${d.treatsMult}`}</span>
                    <span className="chip gold">{`✦ ${d.glory}`}</span>
                    {rules.map(r => (
                      <span key={r} className="chip red">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="section-title">Биом</div>
        <div className="biome-chips">
          <Button sm primary={biome === "random"} icon="🎲" onClick={() => setBiome("random")}>
            Случайно
          </Button>
          {biomes.map(id => (
            <Button key={id} sm primary={biome === id} icon={BIOME_ICON[id] ?? "🗺️"} onClick={() => setBiome(id)}>
              {biomeDef(id).name}
            </Button>
          ))}
        </div>

        <div className="section-title">
          {`Разведка: ${enemies.length} ${enemies.length === 1 ? "враг" : "врагов"}`}
          {map ? ` · ${biomeDef(map.biomeId).name}` : ""}
        </div>
        <div className="stack">
          {enemies.map((e, i) => (
            <UnitRow
              key={e.unit.id}
              unit={e.unit}
              index={i}
              animated={false}
              tags={(
                <>
                  {e.unit.isBoss && <span className="chip red">Вожак</span>}
                  <span className="chip">{STANCE_LABEL[e.stance]}</span>
                </>
              )}
            />
          ))}
          {waves.map(w => (
            <div key={w.turn} className="stack">
              <div className="muted small">
                {`Подкрепление на ходу ${w.turn}`}
                {difficulty === "nightmare" ? " (без предупреждения в бою)" : ""}
              </div>
              {w.units.map(x => (
                <UnitRow key={x.unit.id} unit={x.unit} animated={false} dim />
              ))}
            </div>
          ))}
          {!map && <p className="muted">Разведка…</p>}
        </div>

        <div className="section-title">{`Отряд ${squad.length}/${SQUAD_SIZE}`}</div>
        <p className="muted small">Нажмите на персонажа ростера, чтобы взять его в бой или убрать из отряда.</p>
        <div className="stack">
          {roster.map((u, i) => {
            const inSquad = squadIds.includes(u.id)
            return (
              <UnitRow
                key={u.id}
                unit={u}
                index={i}
                animated={false}
                selected={inSquad}
                dim={!inSquad && squad.length >= SQUAD_SIZE}
                onClick={() => onToggle(u.id)}
                right={inSquad ? <span className="chip squad">В отряде</span> : undefined}
              />
            )
          })}
        </div>

        <div className="card power-card">
          <div className="row between">
            <span>Сила отряда</span>
            <b className={ratioClass}>{ratioLabel}</b>
          </div>
          <div className="muted small">
            {`Ваши ${squadPower} против ${enemyPower} у врагов (с подкреплениями)`}
          </div>
          <div className="bar" style={{ marginTop: 8 }}>
            <div className={barClass} style={{ width: `${Math.min(100, ratio * 50)}%` }} />
          </div>
        </div>
        <div className="warning-box">☠️ Павшие в бою не возвращаются</div>
        <Button big primary block pulse={squad.length > 0} icon="⚔️" onClick={onStart} disabled={squad.length === 0 || !map}>
          Начать бой
        </Button>
      </div>
      {toastEl}
    </div>
  )
}
