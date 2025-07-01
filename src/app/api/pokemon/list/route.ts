import { db } from "@db"
import { NextRequest } from "next/server"
import {
  listRequestSchema,
  listResponseSchema
} from "@shared/api/schema/pokemon/list"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = listRequestSchema.safeParse(body)

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

  const {
    page,
    limit,
    tags
  } = result.data

  try {
    const data = await db.query.pokemonsSchema.findMany({
      with: {
        tags: {
          with: {
            tag: true
          }
        }
      }
    })

    let formatted = data.map(pokemon => ({
      ...pokemon,
      tags: pokemon.tags.map(tag => tag.tag)
    }))

    if (tags && tags.length > 0) {
      formatted = formatted.filter((pokemon) => {
        return pokemon.tags.some(tag => tags.includes(tag.id))
      })
    }

    // I know how it looks like, but drizzle doesn't support many to many filtering right now :С
    // And I so don't want to use native sql dialect and for this request I did pagination on JS
    const paginated = formatted.slice(page * limit, (page + 1) * limit)

    const parsedResponse = listResponseSchema.safeParse({
      data: paginated,
      pagination: {
        count: paginated.length
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
  catch {
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
