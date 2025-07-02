import path from "path"
import fs from "fs"
import execa from "execa"
import { db, tagsSchema, pokemonsSchema, pokemonsTagsSchema } from "@db"
import sharp from "sharp"
import { sql, getTableName } from "drizzle-orm"

async function preparePokemonTableData(imgPath: string, shinyTag: string): Promise<void> {
  const files = fs.readdirSync(imgPath).filter(file => file.endsWith(".webp"))

  for (const file of files) {
    const { width, height } = await sharp(`${imgPath}/${file}`).metadata()
    const fileName = path.parse(file).name
    const fileAlt = path.parse(file).name.split(".")[0]
    const isShiny = fileName.split(".").includes("shiny")

    try {
      const [{ id }] = await db.insert(pokemonsSchema).values({
        name: fileName,
        width: width,
        height: height,
        alt: fileAlt
      }).returning()

      if (isShiny && shinyTag) {
        await db.insert(pokemonsTagsSchema).values({
          pokemonId: id,
          tagId: shinyTag
        })
      }
    }
    catch (error) {
      console.error(`Failed to insert data ${file}: ${(error as Error).message}`)
    }
  }
}

(async () => {
  try {
    await execa("npx", ["drizzle-kit", "push"], {
      stdio: "inherit"
    })
  }
  catch (error) {
    console.error("Migration process error:", error)

    return
  }

  try {
    await db.execute(sql`
    TRUNCATE TABLE
        ${sql.raw(getTableName(pokemonsTagsSchema))},
        ${sql.raw(getTableName(pokemonsSchema))},
        ${sql.raw(getTableName(tagsSchema))}
    RESTART IDENTITY CASCADE
  `)
  }
  catch (error) {
    console.error("Truncate process error:", error)

    return
  }

  let shinyTag: string = ""

  try {
    const [{ id: tagId }] = await db.insert(tagsSchema).values({
      name: "shiny"
    }).returning()

    shinyTag = tagId
  }
  catch (error) {
    console.error("Creating shiny tag error:", error)

    return
  }

  await preparePokemonTableData(
    path.resolve("./public/uploads/pokemon/images"),
    shinyTag
  )
})()
