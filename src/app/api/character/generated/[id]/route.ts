import { NextRequest } from "next/server"
import { z } from "zod"
import { getGeneratedCharacter } from "@/server/db/queries/listGeneratedCharacters"
import { deleteGeneratedCharacter, updateGeneratedCharacter } from "@/server/db/queries/saveGeneratedCharacter"
import { updateCharacter } from "@/server/character-model/generate"
import {
  generatedCharacterItemResponseSchema, updateCharacterBodySchema, type SavedGeneratedCharacterType
} from "@shared/api/schema/character/generated"
import { availableClasses } from "@shared/character/classes"
import { invalidResponse } from "@/app/api/pokemon/generated/responses"
import { characterErrorResponse } from "../responses"

type Context = { params: Promise<{ id: string }> }

const idSchema = z.uuid()

const notFound = () => Response.json({ error: "Generated character not found" }, { status: 404 })

/** The character and the classes open to it at its level */
const itemResponse = (character: SavedGeneratedCharacterType) => {
  const parsedResponse = generatedCharacterItemResponseSchema.safeParse({
    data: character,
    availableClasses: availableClasses(character.aptitudes, character.level).map(item => item.id)
  })

  return parsedResponse.success ? Response.json(parsedResponse.data, { status: 200 }) : invalidResponse(parsedResponse.error)
}

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params

  // Not a uuid cannot exist; answering 404 keeps Postgres from rejecting the cast
  if (!idSchema.safeParse(id).success) {
    return notFound()
  }

  try {
    const character = await getGeneratedCharacter(id)

    return character ? itemResponse(character) : notFound()
  }
  catch (error) {
    console.error("Failed to get generated character", error)

    return Response.json({ error: "Error when collecting generated characters" }, { status: 500 })
  }
}

/** Levels up and / or changes the class: `{ level?, class? }`; levels only go up, the class must be open */
export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params
  let json: unknown

  try {
    json = await request.json()
  }
  catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 })
  }

  const body = updateCharacterBodySchema.safeParse(json)

  if (!body.success) {
    return Response.json({ error: "Invalid request body", details: z.flattenError(body.error) }, { status: 400 })
  }

  if (!idSchema.safeParse(id).success) {
    return notFound()
  }

  try {
    const character = await getGeneratedCharacter(id)

    if (!character) {
      return notFound()
    }

    const updated = await updateGeneratedCharacter(updateCharacter(character, body.data))

    return updated ? itemResponse(updated) : notFound()
  }
  catch (error) {
    return characterErrorResponse(error, "update generated character")
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params

  if (!idSchema.safeParse(id).success) {
    return notFound()
  }

  try {
    return await deleteGeneratedCharacter(id) ? new Response(null, { status: 204 }) : notFound()
  }
  catch (error) {
    console.error("Failed to delete generated character", error)

    return Response.json({ error: "Error when deleting generated character" }, { status: 500 })
  }
}
