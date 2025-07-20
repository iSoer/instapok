import { db, tagsSchema } from "@db"

export async function GET() {
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
