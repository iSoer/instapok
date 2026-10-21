"use client"
import Link from "next/link"
import { useCharacterModel } from "@api/hooks/useCharacterModel"
import { CharacterGenerator } from "@components/character-generator/CharacterGenerator"
import { Loader } from "@components/ui/Loader"

export default function CharactersPage() {
  const { data: model, error } = useCharacterModel()

  return (
    <main className="min-h-dvh px-16 py-24 sm:px-24">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-24">
        <header className="flex items-baseline justify-between gap-16">
          <h1 className="text-2xl">Character generator</h1>
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Back to the feed</Link>
        </header>
        <p className="text-sm text-neutral-400">
          Pick a rarity and spend its budget on the stats at level 80; each star adds a little to the budget, like in
          Fire Emblem Heroes. Stats and weapon ranks grow with the level, linearly and deterministically. Talents rank up
          fastest, weak skills slowest. As in Fire Emblem: Fortune&apos;s Weave, class tiers open at levels 5, 20, 35, 45
          and 60, and each class asks for weapon or movement ranks; the class adds its bonus to the stats.
        </p>
        {
          error
            ? <div className="text-red-400">Could not load the character model</div>
            : model
              ? <CharacterGenerator model={model.data} />
              : <Loader />
        }
      </div>
    </main>
  )
}
