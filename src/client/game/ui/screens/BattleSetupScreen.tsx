import { useEffect, useState } from "react"
import { useStore } from "@nanostores/react"
import type { Difficulty } from "@game/core/types"
import { SQUAD_SIZE } from "@game/core/types"
import { visibleStats } from "@game/core/units"
import { DIFFICULTIES } from "@game/content/balance"
import { biomeDef } from "@game/content/biomes"
import { $save, $unlockedBiomes, difficultyUnlocked, startBattle } from "@game/state/save"
import { navigate } from "@game/state/router"
import { Button } from "../components/Button"
import { TopBar } from "../components/TopBar"
import { ResourceBar } from "../components/ResourceBar"
import { UnitAvatar } from "../components/UnitAvatar"
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
const BIOME_ICON: Record<string, string> = { yard: "🏡", roofs: "🏙️", basement: "🕯️", dump: "🗑️", winter_park: "❄️" }

export function BattleSetupScreen() {
  const save = useStore($save)
  const biomes = useStore($unlockedBiomes)
  const army = save.army
  const [difficulty, setDifficulty] = useState<Difficulty>("easy")
  const [biome, setBiome] = useState<string>("random")
  const [toastEl, toast] = useToast()

  useEffect(() => {
    if (!army) navigate("/", true)
  }, [army])

  if (!army) return <div className="screen" />

  // Отряд — это вся армия (4 слота).
  const squadUnits = army.units
  const squad = squadUnits.map(u => u.id)

  const def = DIFFICULTIES.find(d => d.id === difficulty) ?? DIFFICULTIES[0]
  const avgLevel = squadUnits.length ? squadUnits.reduce((a, u) => a + u.level, 0) / squadUnits.length : 1
  const squadPower = squadUnits.reduce((a, u) => a + statTotal(visibleStats(u)), 0)
  const enemyCount = def ? (def.enemies[0] + def.enemies[1]) / 2 : 4
  const enemyLevel = def ? avgLevel + (def.levelRange[0] + def.levelRange[1]) / 2 : avgLevel
  const enemyPower = Math.round(enemyCount * (50 + 2.95 * Math.max(0, enemyLevel - 1)))
  const ratio = enemyPower > 0 ? squadPower / enemyPower : 1
  const ratioLabel
    = ratio >= 1.1 ? "Преимущество у вас" : ratio >= 0.85 ? "Силы равны" : ratio >= 0.6 ? "Будет тяжело" : "Самоубийство"
  const ratioClass = ratio >= 1.0 ? "ok" : ratio >= 0.75 ? "warn" : "danger"
  const barClass = ratio >= 1.0 ? "good" : ratio >= 0.75 ? "mid" : "bad"

  const onStart = () => {
    if (squad.length === 0) return toast("В отряде никого нет — наймите бойцов", true)
    const r = startBattle({ difficulty, biomeId: biome, squadIds: squad })
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
                    <span className="chip">
                      Врагов
                      {" "}
                      {d.enemies[0]}
                      –
                      {d.enemies[1]}
                    </span>
                    <span className="chip">
                      Уровень
                      {" "}
                      {d.levelRange[0] >= 0 ? "+" : ""}
                      {d.levelRange[0]}
                      …+
                      {d.levelRange[1]}
                    </span>
                    <span className="chip">
                      🦴 ×
                      {d.treatsMult}
                    </span>
                    <span className="chip gold">
                      ✦
                      {d.glory}
                    </span>
                    <span className="chip">
                      Рекрут
                      {Math.round(d.recruitChance * 100)}
                      %
                    </span>
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
          Отряд
          {" "}
          {squad.length}
          /
          {SQUAD_SIZE}
        </div>
        <div className="squad-slots">
          {Array.from({ length: SQUAD_SIZE }, (_, i) => {
            const u = squadUnits[i]
            return u
              ? (
                  <div key={u.id} className="squad-slot filled pop-in" onClick={() => navigate(`/army/${u.id}`)}>
                    <UnitAvatar unit={u} size="sm" />
                    <span className="nm">{u.name}</span>
                    <span className="muted">
                      Ур.
                      {u.level}
                    </span>
                  </div>
                )
              : (
                  <div key={`empty-${i}`} className="squad-slot empty readonly" onClick={() => navigate("/army")}>
                    <span className="plus">·</span>
                    <span className="muted">пусто</span>
                  </div>
                )
          })}
        </div>
        {squad.length < SQUAD_SIZE && (
          <div className="muted small">
            Свободных слотов:
            {SQUAD_SIZE - squad.length}
            . Нанять можно в «Моей армии».
          </div>
        )}
        <div className="card power-card">
          <div className="row between">
            <span>Сила отряда</span>
            <b className={ratioClass}>{ratioLabel}</b>
          </div>
          <div className="muted small">
            Ваши
            {" "}
            <b>{squadPower}</b>
            {" "}
            против ≈
            <b>{enemyPower}</b>
            {" "}
            у врага
          </div>
          <div className="bar" style={{ marginTop: 8 }}>
            <div className={barClass} style={{ width: `${Math.min(100, ratio * 50)}%` }} />
          </div>
        </div>
        <div className="warning-box">☠️ Павшие в бою не возвращаются</div>
        <Button big primary block pulse={squad.length > 0} icon="⚔️" onClick={onStart} disabled={squad.length === 0}>
          Начать бой
        </Button>
      </div>
      {toastEl}
    </div>
  )
}
