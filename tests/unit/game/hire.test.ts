import { beforeEach, describe, expect, it } from "vitest"
import {
  $save,
  confirmRoster,
  beginRosterCreation,
  currentHireCost,
  freeSlots,
  hireAction,
  releaseUnit,
  $rosterUnits
} from "@game/state/save"
import { createEmptySave, parseSave, serializeSave } from "@game/core/save"
import { hireCost } from "@game/core/progression"
import { BARRACKS_CAP } from "@game/core/types"

function freshArmy(): void {
  const save = createEmptySave(1)
  save.profile.treats = 1000
  $save.set(save)
  beginRosterCreation("army")
  const roster = $rosterUnits.get()
  const r = confirmRoster(roster.slice(0, 4).map(u => u.id))
  expect(r.ok).toBe(true)
}

describe("найм в слоты", () => {
  beforeEach(() => freshArmy())

  it("цена: 60, затем +20 за каждый найм; сброс после боя", () => {
    expect(hireCost(0)).toBe(60)
    expect(hireCost(1)).toBe(80)
    expect(hireCost(2)).toBe(100)
    expect(currentHireCost($save.get())).toBe(60)
  })

  it("армия из 4 слотов: пока все заняты — нанять нельзя", () => {
    expect(freeSlots($save.get())).toBe(0)
    expect(hireAction(0).ok).toBe(false)
  })

  it("после потери бойца слот освобождается, найм списывает цену и повышает её", () => {
    const s = $save.get()
    const victim = s.army!.units[0]!
    releaseUnit(victim.id)
    expect(freeSlots($save.get())).toBe(1)
    expect($save.get().shelter.candidates.length).toBe(3)
    const treatsBefore = $save.get().profile.treats
    const r = hireAction(1)
    expect(r.ok).toBe(true)
    const after = $save.get()
    expect(after.army!.units.length).toBe(BARRACKS_CAP)
    expect(after.army!.squadIds.length).toBe(BARRACKS_CAP)
    expect(after.profile.treats).toBe(treatsBefore - 60)
    expect(after.profile.hiresSinceBattle).toBe(1)
    expect(currentHireCost(after)).toBe(80)
    // кандидаты обновились
    expect(after.shelter.candidates.length).toBe(3)
  })

  it("недостаточно Вкусняшек — отказ без изменений", () => {
    releaseUnit($save.get().army!.units[0]!.id)
    $save.set({ ...$save.get(), profile: { ...$save.get().profile, treats: 10 } })
    const r = hireAction(0)
    expect(r.ok).toBe(false)
    expect($save.get().army!.units.length).toBe(3)
  })

  it("пленник нанимается бесплатно и не повышает цену", () => {
    releaseUnit($save.get().army!.units[0]!.id)
    const s = $save.get()
    const captive = { ...s.shelter.candidates[0]!, id: "captive_1" }
    $save.set({ ...s, shelter: { ...s.shelter, captive } })
    const treats = $save.get().profile.treats
    expect(hireAction("captive").ok).toBe(true)
    expect($save.get().profile.treats).toBe(treats)
    expect($save.get().profile.hiresSinceBattle).toBe(0)
    expect($save.get().shelter.captive).toBeUndefined()
  })

  it("сейвы прежней игры (v1–v2, без модели персонажа) отклоняются", () => {
    const old = JSON.parse(serializeSave($save.get())) as Record<string, unknown>
    for (const version of [1, 2]) {
      const r = parseSave(JSON.stringify({ ...old, version }))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain(`версии ${version}`)
    }
    expect(parseSave(serializeSave($save.get())).ok).toBe(true)
  })
})
