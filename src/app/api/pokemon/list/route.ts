import { NextRequest } from "next/server"
import { listPokemons } from "@/server/db/queries/listPokemons"
import {
  listRequestSchema,
  listResponseSchema
} from "@shared/api/schema/pokemon/list"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const result = listRequestSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    // Repeated keys: ?tags=<uuid>&tags=<uuid>
    tags: searchParams.getAll("tags")
  })

  if (!result.success) {
    return Response.json(
      {
        error: "Invalid query parameters",
        details: result.error.flatten()
      },
      {
        status: 400
      }
    )
  }

  try {
    const { data, total } = await listPokemons(result.data)

    const parsedResponse = listResponseSchema.safeParse({
      data,
      pagination: {
        count: data.length,
        total
      }
    })

    if (!parsedResponse.success) {
      return Response.json({
        error: "Internal Server Error: Invalid response format",
        details: parsedResponse.error.flatten()
      }, {
        status: 500
      })
    }

    return Response.json(
      parsedResponse.data,
      {
        status: 200
      }
    )
  }
  catch (error) {
    console.error("Failed to list pokemons", error)

    return Response.json(
      {
        error: "Error when collecting pokemons"
      },
      {
        status: 500
      }
    )
  }
}
