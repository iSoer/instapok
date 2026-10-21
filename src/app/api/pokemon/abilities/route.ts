import { z } from "zod"
import { listAbilities } from "@/server/db/queries/listAbilities"
import { abilitiesResponseSchema } from "@shared/api/schema/pokemon/abilities"

export async function GET() {
  try {
    const parsedResponse = abilitiesResponseSchema.safeParse({
      data: await listAbilities()
    })

    if (!parsedResponse.success) {
      return Response.json({
        error: "Internal Server Error: Invalid response format",
        details: z.flattenError(parsedResponse.error)
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
    console.error("Failed to list abilities", error)

    return Response.json(
      {
        error: "Error when collecting abilities"
      },
      {
        status: 500
      }
    )
  }
}
