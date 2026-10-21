import { z } from "zod"
import { NameTakenError } from "@/server/db/queries/saveGeneratedPokemon"
import { GenerateRequestError } from "@/server/pokemon-model/generate"
import { BaseNotFoundError } from "@/server/pokemon-model/runGeneration"
import { generateBodySchema, type GenerateBodyType } from "@shared/api/schema/pokemon/generated"

// Helpers shared by the /api/pokemon/generated route handlers

export const invalidResponse = (error: z.ZodError) => Response.json({
  error: "Internal Server Error: Invalid response format",
  details: z.flattenError(error)
}, {
  status: 500
})

/** Parsed body, or the 400 response to return */
export const parseGenerateBody = async (request: Request): Promise<GenerateBodyType | Response> => {
  let json: unknown

  try {
    json = await request.json()
  }
  catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 })
  }

  const result = generateBodySchema.safeParse(json)

  if (!result.success) {
    return Response.json({ error: "Invalid request body", details: z.flattenError(result.error) }, { status: 400 })
  }

  return result.data
}

/** Known errors of generation and saving as responses; anything else is logged and a generic 500 */
export const generationErrorResponse = (error: unknown, action: string) => {
  if (error instanceof GenerateRequestError) {
    return Response.json({ error: "Invalid generation request", violations: error.violations }, { status: 400 })
  }

  if (error instanceof BaseNotFoundError) {
    return Response.json({ error: "Base pokemon not found" }, { status: 404 })
  }

  if (error instanceof NameTakenError) {
    return Response.json({ error: "Pokemon name already taken", names: error.names }, { status: 409 })
  }

  console.error(`Failed to ${action}`, error)

  return Response.json({ error: `Error when trying to ${action}` }, { status: 500 })
}
