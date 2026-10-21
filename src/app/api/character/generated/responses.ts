import { z } from "zod"
import { NameTakenError } from "@/server/db/queries/saveGeneratedPokemon"
import { ClassTakenError } from "@/server/db/queries/saveGeneratedCharacter"
import { GenerateRequestError } from "@/server/pokemon-model/generate"
import { generateCharacterBodySchema, type GenerateCharacterBodyType } from "@shared/api/schema/character/generated"

// Helpers shared by the /api/character/generated route handlers

/** Parsed body, or the 400 response to return */
export const parseCharacterBody = async (request: Request): Promise<GenerateCharacterBodyType | Response> => {
  let json: unknown

  try {
    json = await request.json()
  }
  catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 })
  }

  const result = generateCharacterBodySchema.safeParse(json)

  if (!result.success) {
    return Response.json({ error: "Invalid request body", details: z.flattenError(result.error) }, { status: 400 })
  }

  return result.data
}

/** Known errors of generation and saving as responses; anything else is logged and a generic 500 */
export const characterErrorResponse = (error: unknown, action: string) => {
  if (error instanceof GenerateRequestError) {
    return Response.json({ error: "Invalid generation request", violations: error.violations }, { status: 400 })
  }

  if (error instanceof NameTakenError) {
    return Response.json({ error: "Character name already taken", names: error.names }, { status: 409 })
  }

  if (error instanceof ClassTakenError) {
    return Response.json({ error: "Divine class already held by another character", class: error.classId }, { status: 409 })
  }

  console.error(`Failed to ${action}`, error)

  return Response.json({ error: `Error when trying to ${action}` }, { status: 500 })
}
