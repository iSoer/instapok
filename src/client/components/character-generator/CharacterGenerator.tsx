import { memo, useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { useSWRConfig } from "swr"
import { twMerge } from "@lib/tailwind-merge"
import { STATS, type Stat } from "@shared/api/schema/pokemon/generated"
import type { GeneratedCharacterType } from "@shared/api/schema/character/generated"
import { CHARACTER_STAT_LABELS, type Rarity } from "@shared/character/leveling"
import { ranksAtLevel, skillsWith, type Skill } from "@shared/character/skills"
import type { GeneratorResult } from "@api/generator"
import { previewCharacter, saveCharacter, type CharacterBody } from "@api/characterGenerator"
import { RECENT_CHARACTERS_URL } from "@api/hooks/useRecentGeneratedCharacters"
import { limitsOf, reachableOf, tierOf, totalOf } from "@lib/pokemon-generator/generatorState"
import {
  aptitudeOf, aptitudesOfState, characterIssuesOf, characterReducer, initialCharacterState, openClassesOf, rarityOfKey,
  toCustomCharacter, toGeneratorModel, type CharacterAction, type CharacterModel, type CharacterState
} from "@lib/character-generator/characterState"
import { StatSlider } from "../pokemon-generator/StatSlider"
import { DEFAULT_COLOR } from "../pokemon-generator/typeColors"
import { CharacterPreviewCard, type CharacterPreviewCardPropsType, type CharacterPreviewState } from "./CharacterPreviewCard"
import { ClassPicker } from "./ClassPicker"
import { RarityPanel } from "./RarityPanel"
import { RecentCharacters } from "./RecentCharacters"
import { SkillPicker } from "./SkillPicker"

export type CharacterGeneratorPropsType = {
  model: CharacterModel
}

// Server check of the hand-made character waits for the sliders to settle
const PREVIEW_DELAY_MS = 250

const newSeed = () => Math.floor(Math.random() * 2 ** 32)

type Message = CharacterPreviewCardPropsType["message"]

const card = twMerge("flex flex-col gap-16 rounded-lg border border-neutral-800 bg-neutral-950 p-16")

export const CharacterGenerator = memo(function CharacterGenerator({ model: characterModel }: CharacterGeneratorPropsType) {
  // A rarity is a class of the pokemon generator state: the same budget and slider rules
  const model = useMemo(() => toGeneratorModel(characterModel), [characterModel])
  const reducer = useCallback(
    (state: CharacterState, action: CharacterAction) => characterReducer(model, state, action),
    [model]
  )
  const [state, dispatch] = useReducer(reducer, model, initialCharacterState)
  const [seed, setSeed] = useState(newSeed)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>()
  const [preview, setPreview] = useState<{ key: string, result: GeneratorResult<GeneratedCharacterType> }>()
  const { mutate } = useSWRConfig()

  const { budget } = state
  const rarity = rarityOfKey(budget.classKey)
  const tier = useMemo(() => tierOf(model, budget.classKey, []), [model, budget.classKey])
  const limits = useMemo(() => limitsOf(model, budget.classKey, [], budget.budget), [model, budget.classKey, budget.budget])
  const aptitudes = useMemo(() => aptitudesOfState(state), [state])
  const ranks = useMemo(() => ranksAtLevel(aptitudes, state.level), [aptitudes, state.level])
  const open = useMemo(() => new Set(openClassesOf(state).map(item => item.id)), [state])
  const issues = useMemo(() => characterIssuesOf(model, state), [model, state])
  const blocked = issues.some(issue => issue.level === "error")

  // The body the server checks: level 1, size, experience and archetype come from the model
  const bodyKey = blocked ? undefined : JSON.stringify({ mode: "custom", character: toCustomCharacter(state), seed })

  useEffect(() => {
    if (!bodyKey) {
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      previewCharacter(JSON.parse(bodyKey) as CharacterBody, controller.signal)
        .then(result => setPreview({ key: bodyKey, result }))
        .catch((error: Error) => {
          if (!controller.signal.aborted) {
            setPreview({ key: bodyKey, result: { ok: false, status: 0, error: error.message, violations: [] } })
          }
        })
    }, PREVIEW_DELAY_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [bodyKey])

  const previewState: CharacterPreviewState = useMemo(() => {
    if (!bodyKey) {
      return { status: "idle" }
    }

    if (preview?.key !== bodyKey) {
      return { status: "loading" }
    }

    return preview.result.ok
      ? { status: "ok", character: preview.result.data[0] }
      : { status: "error", error: preview.result.error, violations: preview.result.violations }
  }, [bodyKey, preview])

  const onStatChange = useCallback((stat: Stat, value: number) => dispatch({ type: "setStat", stat, value }), [])
  const onRarityChange = useCallback((value: Rarity) => dispatch({ type: "setRarity", rarity: value }), [])
  const onBudgetChange = useCallback((value: number) => dispatch({ type: "setBudget", budget: value }), [])
  const onSkillCycle = useCallback((skill: Skill) => dispatch({ type: "cycleSkill", skill }), [])
  const onLevelChange = useCallback((level: number) => dispatch({ type: "setLevel", level }), [])
  const onClassChange = useCallback((classId: string) => dispatch({ type: "setClass", classId }), [])
  const onNameChange = useCallback((name: string) => dispatch({ type: "setName", name }), [])
  const onReroll = useCallback(() => setSeed(newSeed()), [])
  const skillAptitude = useCallback((skill: Skill) => aptitudeOf(state, skill), [state])

  const failed = (text: string, result: Extract<GeneratorResult<unknown>, { ok: false }>) => setMessage({
    level: "error",
    text: `${text}: ${result.error}`,
    details: result.violations
  })

  const onRandom = async () => {
    setBusy(true)
    setMessage(undefined)

    const result = await previewCharacter({ mode: "single", request: { rarity } })

    setBusy(false)

    if (!result.ok) {
      return failed("Could not generate", result)
    }

    const [character] = result.data

    dispatch({
      type: "load",
      state: {
        rarity: character.rarity,
        stats: character.maxStats,
        talents: skillsWith(character.aptitudes, "talent"),
        weaknesses: skillsWith(character.aptitudes, "weak"),
        level: character.level,
        classId: character.class
      }
    })
    setSeed(character.seed)
  }

  const onDistribute = async () => {
    setBusy(true)
    setMessage(undefined)

    // The generator spreads exactly this budget for the rarity and talents
    const result = await previewCharacter({
      mode: "single",
      request: { rarity, budget: budget.budget, talents: state.talents, level: state.level },
      seed
    })

    setBusy(false)

    if (!result.ok) {
      return failed("Could not distribute", result)
    }

    dispatch({ type: "applyStats", stats: result.data[0].maxStats })
  }

  const onSave = async () => {
    if (!bodyKey) {
      return
    }

    setBusy(true)

    const result = await saveCharacter(JSON.parse(bodyKey) as CharacterBody)

    setBusy(false)

    if (!result.ok) {
      return failed("Not saved", result)
    }

    setMessage({ level: "ok", text: `Saved ${result.data[0].name}` })
    void mutate(RECENT_CHARACTERS_URL)
    // A fresh seed and name, so the next save is not a duplicate
    setSeed(newSeed())
    dispatch({ type: "setName", name: "" })
  }

  return (
    <div className="grid gap-16 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-16">
        <div className={card}>
          <RarityPanel
            rarities={characterModel.rarities}
            rarity={rarity}
            maxLevel={characterModel.maxLevel}
            budget={budget.budget}
            tier={tier}
            spent={totalOf(budget.stats)}
            onRarityChange={onRarityChange}
            onBudgetChange={onBudgetChange}
          />
          <div className="grid gap-16 sm:grid-cols-2">
            {
              STATS.map(stat => (
                <StatSlider
                  key={stat}
                  stat={stat}
                  label={CHARACTER_STAT_LABELS[stat]}
                  value={budget.stats[stat]}
                  min={limits[stat].min}
                  max={Math.max(limits[stat].max, limits[stat].min + 5)}
                  reachable={reachableOf(model, budget, stat, limits)}
                  locked={limits[stat].locked}
                  color={DEFAULT_COLOR}
                  onChange={onStatChange}
                />
              ))
            }
          </div>
        </div>
        <div className={card}>
          <SkillPicker
            aptitudeOf={skillAptitude}
            ranks={ranks}
            level={state.level}
            talents={state.talents.length}
            weaknesses={state.weaknesses.length}
            onCycle={onSkillCycle}
          />
        </div>
        <div className={card}>
          <ClassPicker
            aptitudes={aptitudes}
            level={state.level}
            classId={state.classId}
            open={open}
            onLevelChange={onLevelChange}
            onClassChange={onClassChange}
          />
        </div>
      </div>
      <div className="flex flex-col gap-16 lg:sticky lg:top-16 lg:self-start">
        <CharacterPreviewCard
          preview={previewState}
          issues={issues}
          name={budget.name}
          busy={busy}
          canDistribute={state.talents.length > 0}
          message={message}
          onNameChange={onNameChange}
          onSave={onSave}
          onRandom={onRandom}
          onDistribute={onDistribute}
          onReroll={onReroll}
        />
        <RecentCharacters />
      </div>
    </div>
  )
})
