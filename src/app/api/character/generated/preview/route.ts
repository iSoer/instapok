import { NextRequest } from "next/server"
import { runCharacterGeneration } from "@/server/character-model/runGeneration"
import { generateCharacterPreviewResponseSchema } from "@shared/api/schema/character/generated"
import { invalidResponse } from "@/app/api/pokemon/generated/responses"
import { characterErrorResponse, parseCharacterBody } from "../responses"

/** Generates without saving; with the same seed POST /api/character/generated saves exactly this */
export async function POST(request: NextRequest) {
  const body = await parseCharacterBody(request)

  if (body instanceof Response) {
    return body
  }

  try {
    const parsedResponse = generateCharacterPreviewResponseSchema.safeParse({ data: [runCharacterGeneration(body)] })

    if (!parsedResponse.success) {
      return invalidResponse(parsedResponse.error)
    }

    return Response.json(parsedResponse.data, { status: 200 })
  }
  catch (error) {
    return characterErrorResponse(error, "generate character")
  }
}
