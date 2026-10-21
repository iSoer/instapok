import type { GenerateCharacterBodyType } from "@shared/api/schema/character/generated"
import { randomSeed } from "@/server/pokemon-model/random"
import { buildCustomCharacter, generateCharacter, type GeneratedCharacter } from "./generate"
import { loadCharacterModel } from "./model"

/**
 * Runs the generator for an API body (preview and save share it).
 * Without a seed a random one is picked; it is returned in the character.
 */
export const runCharacterGeneration = (body: GenerateCharacterBodyType): GeneratedCharacter => {
  const model = loadCharacterModel()
  const seed = body.seed ?? randomSeed()

  return body.mode === "single"
    ? generateCharacter(model, body.request, seed)
    : buildCustomCharacter(model, body.character, seed)
}
