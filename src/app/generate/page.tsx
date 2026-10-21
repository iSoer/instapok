"use client"
import Link from "next/link"
import { useMemo } from "react"
import { useGeneratorModel } from "@api/hooks/useGeneratorModel"
import { usePokemonAbilities } from "@api/hooks/usePokemonAbilities"
import { PokemonGenerator } from "@components/pokemon-generator/PokemonGenerator"
import type { AbilityDescription } from "@components/pokemon-generator/AbilityPicker"
import { Loader } from "@components/ui/Loader"

export default function GeneratePage() {
  const { data: model, error } = useGeneratorModel()
  // Display names and effects; the page works without them (slugs are shown)
  const { data: abilities } = usePokemonAbilities()

  const descriptions = useMemo(() => new Map<string, AbilityDescription>(
    (abilities?.data ?? []).filter(ability => ability.sourceId === 0).map(ability => [ability.name, ability])
  ), [abilities])

  return (
    <main className="min-h-dvh px-16 py-24 sm:px-24">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-24">
        <header className="flex items-baseline justify-between gap-16">
          <h1 className="text-2xl">Pokemon generator</h1>
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Back to the feed</Link>
        </header>
        <p className="text-sm text-neutral-400">
          Pick a class and the max stats budget, then spend it with the sliders: every point a stat gets is taken from the
          budget, and once it is spent the sliders only move down. Types decide which abilities are offered; strong abilities
          (⚡) bend the limits, e.g. Huge Power caps Attack and Wonder Guard fixes HP at 1.
        </p>
        {
          error
            ? <div className="text-red-400">Could not load the generator model</div>
            : model
              ? <PokemonGenerator model={model.data} descriptions={descriptions} />
              : <Loader />
        }
      </div>
    </main>
  )
}
