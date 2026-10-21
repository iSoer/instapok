import { NextRequest } from "next/server"
import { z } from "zod"
import { getGeneratedPokemon } from "@/server/db/queries/listGeneratedPokemon"
import { deleteGeneratedPokemon } from "@/server/db/queries/saveGeneratedPokemon"
import { generatedItemResponseSchema } from "@shared/api/schema/pokemon/generated"
import { invalidResponse } from "../responses"

type Context = { params: Promise<{ id: string }> }

const idSchema = z.uuid()

const notFound = () => Response.json({ error: "Generated pokemon not found" }, { status: 404 })

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params

  // Not a uuid cannot exist; answering 404 keeps Postgres from rejecting the cast
  if (!idSchema.safeParse(id).success) {
    return notFound()
  }

  try {
    const pokemon = await getGeneratedPokemon(id)

    if (!pokemon) {
      return notFound()
    }

    const parsedResponse = generatedItemResponseSchema.safeParse({ data: pokemon })

    if (!parsedResponse.success) {
      return invalidResponse(parsedResponse.error)
    }

    return Response.json(parsedResponse.data, { status: 200 })
  }
  catch (error) {
    console.error("Failed to get generated pokemon", error)

    return Response.json({ error: "Error when collecting generated pokemon" }, { status: 500 })
  }
}

/** Children (later stages, forms) stay, with parent_id set to NULL */
export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params

  if (!idSchema.safeParse(id).success) {
    return notFound()
  }

  try {
    return await deleteGeneratedPokemon(id) ? new Response(null, { status: 204 }) : notFound()
  }
  catch (error) {
    console.error("Failed to delete generated pokemon", error)

    return Response.json({ error: "Error when deleting generated pokemon" }, { status: 500 })
  }
}
