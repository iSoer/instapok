import { memo, useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { useSWRConfig } from "swr"
import { twMerge } from "@lib/tailwind-merge"
import { STATS, type PokemonType, type Stat } from "@shared/api/schema/pokemon/generated"
import { previewPokemon, savePokemon, type GeneratorBody, type GeneratorResult } from "@api/generator"
import { RECENT_GENERATED_URL } from "@api/hooks/useRecentGeneratedPokemon"
import {
  allowedAbilityCounts, classInfoOf, classKeyOfPokemon, generatorReducer, initialGeneratorState, issuesOf, limitsOf,
  reachableOf, rulesOf, tierOf, toCustomPokemon, totalOf, type GeneratorAction, type GeneratorModel, type GeneratorState
} from "@lib/pokemon-generator/generatorState"
import { AbilityPicker, type AbilityDescription } from "./AbilityPicker"
import { BudgetPanel } from "./BudgetPanel"
import { PreviewCard, type PreviewCardPropsType, type PreviewState } from "./PreviewCard"
import { RecentPokemon } from "./RecentPokemon"
import { StatSlider } from "./StatSlider"
import { TypePicker } from "./TypePicker"
import { DEFAULT_COLOR, TYPE_COLORS } from "./typeColors"
import type { GeneratedPokemonType } from "@shared/api/schema/pokemon/generated"

export type PokemonGeneratorPropsType = {
  model: GeneratorModel
  descriptions: Map<string, AbilityDescription>
}

// Server check of the hand-made pokemon waits for the sliders to settle
const PREVIEW_DELAY_MS = 250

const newSeed = () => Math.floor(Math.random() * 2 ** 32)

type Message = PreviewCardPropsType["message"]

const card = twMerge("flex flex-col gap-16 rounded-lg border border-neutral-800 bg-neutral-950 p-16")

export const PokemonGenerator = memo(function PokemonGenerator({ model, descriptions }: PokemonGeneratorPropsType) {
  const reducer = useCallback(
    (state: GeneratorState, action: GeneratorAction) => generatorReducer(model, state, action),
    [model]
  )
  const [state, dispatch] = useReducer(reducer, model, initialGeneratorState)
  const [seed, setSeed] = useState(newSeed)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>()
  const [preview, setPreview] = useState<{ key: string, result: GeneratorResult<GeneratedPokemonType> }>()
  const { mutate } = useSWRConfig()

  const info = classInfoOf(model, state.classKey)
  const tier = useMemo(() => tierOf(model, state.classKey, state.abilities), [model, state.classKey, state.abilities])
  const limits = useMemo(
    () => limitsOf(model, state.classKey, state.abilities, state.budget),
    [model, state.classKey, state.abilities, state.budget]
  )
  const issues = useMemo(() => issuesOf(model, state), [model, state])
  const allowedCounts = useMemo(() => allowedAbilityCounts(model, state.classKey), [model, state.classKey])
  const blocked = issues.some(issue => issue.level === "error")
  const color = state.types[0] ? TYPE_COLORS[state.types[0]] : DEFAULT_COLOR
  const tierReason = rulesOf(model, state.abilities).find(({ rule }) => (rule.bstFactor ?? 1) !== 1)?.ability
  const multipliers = useMemo(() => {
    const result: Partial<Record<Stat, { value: number, reason: string }>> = {}

    for (const { ability, rule } of rulesOf(model, state.abilities)) {
      for (const [stat, value] of Object.entries(rule.statMultiplier ?? {}) as [Stat, number][]) {
        result[stat] = { value, reason: ability }
      }
    }

    return result
  }, [model, state.abilities])

  // The body the server checks: size, experience and archetype come from the model, plausibility from its validator
  const bodyKey = blocked ? undefined : JSON.stringify({ mode: "custom", pokemon: toCustomPokemon(model, state), seed })

  useEffect(() => {
    if (!bodyKey) {
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      previewPokemon(JSON.parse(bodyKey) as GeneratorBody, controller.signal)
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

  const previewState: PreviewState = useMemo(() => {
    if (!bodyKey) {
      return { status: "idle" }
    }

    if (preview?.key !== bodyKey) {
      return { status: "loading" }
    }

    return preview.result.ok
      ? { status: "ok", pokemon: preview.result.data[0] }
      : { status: "error", error: preview.result.error, violations: preview.result.violations }
  }, [bodyKey, preview])

  const onStatChange = useCallback((stat: Stat, value: number) => dispatch({ type: "setStat", stat, value }), [])
  const onClassChange = useCallback((classKey: string) => dispatch({ type: "setClass", classKey }), [])
  const onBudgetChange = useCallback((budget: number) => dispatch({ type: "setBudget", budget }), [])
  const onTypeToggle = useCallback((pokemonType: PokemonType) => dispatch({ type: "toggleType", pokemonType }), [])
  const onAbilityToggle = useCallback((ability: string) => dispatch({ type: "toggleAbility", ability }), [])
  const onNameChange = useCallback((name: string) => dispatch({ type: "setName", name }), [])
  const onReroll = useCallback(() => setSeed(newSeed()), [])

  const failed = (text: string, result: Extract<GeneratorResult<unknown>, { ok: false }>) => setMessage({
    level: "error",
    text: `${text}: ${result.error}`,
    details: result.violations
  })

  const classRequest = { class: info.class, ...(info.stage && { stage: info.stage }) }

  const onRandom = async () => {
    setBusy(true)
    setMessage(undefined)

    const result = await previewPokemon({
      mode: "single",
      request: { ...classRequest, ...(state.types.length > 0 && { types: state.types }) }
    })

    setBusy(false)

    if (!result.ok) {
      return failed("Could not generate", result)
    }

    const [pokemon] = result.data

    dispatch({
      type: "load",
      state: {
        classKey: classKeyOfPokemon(model, pokemon) ?? state.classKey,
        types: pokemon.types,
        abilities: pokemon.abilities,
        stats: pokemon.stats,
        name: ""
      }
    })
    setSeed(pokemon.seed)
  }

  const onDistribute = async () => {
    setBusy(true)
    setMessage(undefined)

    // The generator spreads exactly this budget for the class, types and abilities
    const result = await previewPokemon({
      mode: "single",
      request: {
        ...classRequest,
        types: state.types,
        bst: state.budget,
        ...(state.abilities.length > 0 && { abilities: state.abilities })
      },
      seed
    })

    setBusy(false)

    if (!result.ok) {
      return failed("Could not distribute", result)
    }

    dispatch({ type: "applyStats", stats: result.data[0].stats })
  }

  const onSave = async () => {
    if (!bodyKey) {
      return
    }

    setBusy(true)

    const result = await savePokemon(JSON.parse(bodyKey) as GeneratorBody)

    setBusy(false)

    if (!result.ok) {
      return failed("Not saved", result)
    }

    setMessage({ level: "ok", text: `Saved ${result.data[0].name}` })
    void mutate(RECENT_GENERATED_URL)
    // A fresh seed and name, so the next save is not a duplicate
    setSeed(newSeed())
    dispatch({ type: "setName", name: "" })
  }

  return (
    <div className="grid gap-16 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-16">
        <div className={card}>
          <BudgetPanel
            classes={model.classes}
            classKey={state.classKey}
            budget={state.budget}
            tier={tier}
            tierReason={tierReason}
            spent={totalOf(state.stats)}
            forbiddenBst={model.forbiddenBst}
            onClassChange={onClassChange}
            onBudgetChange={onBudgetChange}
          />
          <div className="grid gap-16 sm:grid-cols-2">
            {
              STATS.map(stat => (
                <StatSlider
                  key={stat}
                  stat={stat}
                  value={state.stats[stat]}
                  min={limits[stat].min}
                  max={Math.max(limits[stat].max, limits[stat].min + 5)}
                  reachable={reachableOf(model, state, stat, limits)}
                  locked={limits[stat].locked}
                  reason={limits[stat].reason ?? multipliers[stat]?.reason}
                  multiplier={multipliers[stat]?.value}
                  color={color}
                  onChange={onStatChange}
                />
              ))
            }
          </div>
        </div>
        <div className={card}>
          <TypePicker selected={state.types} onToggle={onTypeToggle} />
        </div>
        <div className={card}>
          <AbilityPicker
            model={model}
            types={state.types}
            selected={state.abilities}
            allowedCounts={allowedCounts}
            limits={limits}
            descriptions={descriptions}
            onToggle={onAbilityToggle}
          />
        </div>
      </div>
      <div className="flex flex-col gap-16 lg:sticky lg:top-16 lg:self-start">
        <PreviewCard
          preview={previewState}
          issues={issues}
          name={state.name}
          descriptions={descriptions}
          busy={busy}
          canDistribute={state.types.length > 0}
          message={message}
          onNameChange={onNameChange}
          onSave={onSave}
          onRandom={onRandom}
          onDistribute={onDistribute}
          onReroll={onReroll}
        />
        <RecentPokemon />
      </div>
    </div>
  )
})
