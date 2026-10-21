import { NextRequest } from "next/server"
import { z } from "zod"
import { listGeneratedPokemon } from "@/server/db/queries/listGeneratedPokemon"
import { saveGeneratedPokemon } from "@/server/db/queries/saveGeneratedPokemon"
import { runGeneration } from "@/server/pokemon-model/runGeneration"
import {
  generatedListRequestSchema,
  generatedListResponseSchema,
  generateSaveResponseSchema
} from "@shared/api/schema/pokemon/generated"
import { generationErrorResponse, invalidResponse, parseGenerateBody } from "./responses"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const result = generatedListRequestSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    // Repeated keys: ?types=fire&types=flying
    types: searchParams.getAll("types"),
    class: searchParams.get("class") || undefined,
    order: searchParams.get("order") || undefined
  })

  if (!result.success) {
    return Response.json(
      {
        error: "Invalid query parameters",
        details: z.flattenError(result.error)
      },
      {
        status: 400
      }
    )
  }

  try {
    const { data, total } = await listGeneratedPokemon(result.data)
    const parsedResponse = generatedListResponseSchema.safeParse({
      data,
      pagination: {
        count: data.length,
        total
      }
    })

    if (!parsedResponse.success) {
      return invalidResponse(parsedResponse.error)
    }

    return Response.json(parsedResponse.data, { status: 200 })
  }
  catch (error) {
    console.error("Failed to list generated pokemon", error)

    return Response.json({ error: "Error when collecting generated pokemon" }, { status: 500 })
  }
}

/** Generates and saves; a line is saved in one transaction with parent links between the stages */
export async function POST(request: NextRequest) {
  const body = await parseGenerateBody(request)

  if (body instanceof Response) {
    return body
  }

  try {
    const { items, parentId } = await runGeneration(body)
    const saved = await saveGeneratedPokemon(items, { parentId })
    // explain is not stored, but the response returns it like the preview does
    const parsedResponse = generateSaveResponseSchema.safeParse({
      data: saved.map((item, i) => ({ ...item, explain: items[i].explain }))
    })

    if (!parsedResponse.success) {
      return invalidResponse(parsedResponse.error)
    }

    return Response.json(parsedResponse.data, { status: 201 })
  }
  catch (error) {
    return generationErrorResponse(error, "save generated pokemon")
  }
}
