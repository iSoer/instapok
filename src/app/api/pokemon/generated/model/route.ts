import { loadModel } from "@/server/pokemon-model/loadModel"
import { toPublicModel } from "@/server/pokemon-model/publicModel"
import { generatorModelResponseSchema } from "@shared/api/schema/pokemon/generated"
import { invalidResponse } from "../responses"

/** Limits and ability pools of the generator model for the /generate page; static per deployment */
export async function GET() {
  const parsedResponse = generatorModelResponseSchema.safeParse({ data: toPublicModel(loadModel()) })

  if (!parsedResponse.success) {
    return invalidResponse(parsedResponse.error)
  }

  return Response.json(parsedResponse.data, { status: 200 })
}
