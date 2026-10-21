import type {
  CustomCharacterType, GenerateCharacterRequestType, GeneratedCharacterType, SavedGeneratedCharacterType
} from "@shared/api/schema/character/generated"
import { postGenerator } from "./generator"

export type CharacterBody
  = | { mode: "custom", character: CustomCharacterType, seed?: number }
    | { mode: "single", request: GenerateCharacterRequestType, seed?: number }

export const previewCharacter = (body: CharacterBody, signal?: AbortSignal) => postGenerator<
  GeneratedCharacterType,
  CharacterBody
>("/api/character/generated/preview", body, signal)

export const saveCharacter = (body: CharacterBody) => postGenerator<SavedGeneratedCharacterType, CharacterBody>(
  "/api/character/generated",
  body
)
