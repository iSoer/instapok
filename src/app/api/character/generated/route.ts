import { NextRequest } from "next/server"
import { z } from "zod"
import { listGeneratedCharacters } from "@/server/db/queries/listGeneratedCharacters"
import { saveGeneratedCharacter } from "@/server/db/queries/saveGeneratedCharacter"
import { runCharacterGeneration } from "@/server/character-model/runGeneration"
import {
  generatedCharacterListRequestSchema,
  generatedCharacterListResponseSchema,
  generateCharacterSaveResponseSchema
} from "@shared/api/schema/character/generated"
import { invalidResponse } from "@/app/api/pokemon/generated/responses"
import { characterErrorResponse, parseCharacterBody } from "./responses"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const result = generatedCharacterListRequestSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    rarity: searchParams.get("rarity") || undefined,
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
    const { data, total } = await listGeneratedCharacters(result.data)
    const parsedResponse = generatedCharacterListResponseSchema.safeParse({
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
    console.error("Failed to list generated characters", error)

    return Response.json({ error: "Error when collecting generated characters" }, { status: 500 })
  }
}

/** Generates and saves */
export async function POST(request: NextRequest) {
  const body = await parseCharacterBody(request)

  if (body instanceof Response) {
    return body
  }

  try {
    const character = runCharacterGeneration(body)
    const saved = await saveGeneratedCharacter(character)
    // explain is not stored, but the response returns it like the preview does
    const parsedResponse = generateCharacterSaveResponseSchema.safeParse({ data: [{ ...saved, explain: character.explain }] })

    if (!parsedResponse.success) {
      return invalidResponse(parsedResponse.error)
    }

    return Response.json(parsedResponse.data, { status: 201 })
  }
  catch (error) {
    return characterErrorResponse(error, "save generated character")
  }
}
