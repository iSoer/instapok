import { db, tagsSchema } from "@db"

export async function POST() {
  try {
    const tags = await db.select().from(tagsSchema)
    return Response.json({
      data: tags
    }, {
      status: 200
    })
  }
  catch {
    return Response.json(
      {
        error: "Error when collecting tags"
      },
      {
        status: 500
      }
    )
  }
}
