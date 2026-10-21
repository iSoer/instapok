import type { GenerateBodyType, GenerationInputType } from "@shared/api/schema/pokemon/generated"
import { getGeneratedPokemon } from "@/server/db/queries/listGeneratedPokemon"
import {
  buildCustomPokemon, generateEvolutionLine, generateMegaForm, generatePokemon, type GeneratedPokemon
} from "./generate"
import { loadModel } from "./loadModel"
import { randomSeed } from "./random"

/** mode "mega" points at a saved pokemon that does not exist */
export class BaseNotFoundError extends Error {
  constructor(public baseId: string) {
    super(`Generated pokemon ${baseId} not found`)
  }
}

export type GenerationResult = {
  items: GeneratedPokemon[]
  // Parent of the first item when it is saved: the base of a mega form
  parentId: string | null
}

/**
 * Runs the generator for an API body (preview and save share it).
 * Without a seed a random one is picked; it is returned in every pokemon.
 */
export const runGeneration = async (body: GenerateBodyType): Promise<GenerationResult> => {
  const model = loadModel()
  const seed = body.seed ?? randomSeed()

  switch (body.mode) {
    case "single":
      return { items: [generatePokemon(model, body.request, seed)], parentId: null }

    case "line":
      return { items: generateEvolutionLine(model, body.request, seed), parentId: null }

    case "custom":
      return { items: [buildCustomPokemon(model, body.pokemon, seed)], parentId: null }

    case "mega": {
      const base = await getGeneratedPokemon(body.baseId)

      if (!base) {
        throw new BaseNotFoundError(body.baseId)
      }

      const input: GenerationInputType = { mode: "mega", baseId: body.baseId }

      return { items: [{ ...generateMegaForm(model, base, seed), input }], parentId: body.baseId }
    }
  }
}
