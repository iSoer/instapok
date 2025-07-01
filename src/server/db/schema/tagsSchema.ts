import { pgTable, uuid, text } from "drizzle-orm/pg-core"

export const tagsSchema = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique()
})
