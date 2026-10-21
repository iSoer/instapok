import { NextRequest } from "next/server"
import { runGeneration } from "@/server/pokemon-model/runGeneration"
import { generatePreviewResponseSchema } from "@shared/api/schema/pokemon/generated"
import { generationErrorResponse, invalidResponse, parseGenerateBody } from "../responses"

/** Generates without saving; with the same seed POST /api/pokemon/generated saves exactly this */
export async function POST(request: NextRequest) {
  const body = await parseGenerateBody(request)

  if (body instanceof Response) {
    return body
  }

  try {
    const { items } = await runGeneration(body)
    const parsedResponse = generatePreviewResponseSchema.safeParse({ data: items })

    if (!parsedResponse.success) {
      return invalidResponse(parsedResponse.error)
    }

    return Response.json(parsedResponse.data, { status: 200 })
  }
  catch (error) {
    return generationErrorResponse(error, "generate pokemon")
  }
}
