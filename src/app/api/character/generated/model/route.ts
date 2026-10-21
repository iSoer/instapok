import { loadCharacterModel } from "@/server/character-model/model"
import { toPublicCharacterModel } from "@/server/character-model/publicModel"
import { characterModelResponseSchema } from "@shared/api/schema/character/generated"
import { invalidResponse } from "@/app/api/pokemon/generated/responses"

/** Rarity tiers, growth and ability pools of the character model for the /characters page; static per deployment */
export async function GET() {
  const parsedResponse = characterModelResponseSchema.safeParse({ data: toPublicCharacterModel(loadCharacterModel()) })

  if (!parsedResponse.success) {
    return invalidResponse(parsedResponse.error)
  }

  return Response.json(parsedResponse.data, { status: 200 })
}
