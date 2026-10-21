import { sql } from "drizzle-orm"
import { pgTable, uuid, text, timestamp, integer, jsonb, bigint, uniqueIndex } from "drizzle-orm/pg-core"
import type { Archetype } from "@shared/api/schema/pokemon/generated"
import type { CharacterInputType } from "@shared/api/schema/character/generated"
import type { Rarity } from "@shared/character/leveling"
import type { ClassTier } from "@shared/character/classes"
import type { Aptitudes } from "@shared/character/skills"
import type { PokemonStats } from "./pokemonInfoSchema"

// Characters made by the character generator (src/server/character-model, docs/character-model.md)
export const generatedCharacterSchema = pgTable("generated_character", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  // 1-5 stars
  rarity: integer("rarity").$type<Rarity>().notNull(),
  // Talent, normal or weak for every weapon and movement skill; ranks at a level follow from them
  aptitudes: jsonb("aptitudes").$type<Aptitudes>().notNull(),
  // PokeAPI units: decimetres and hectograms
  heightDm: integer("height_dm").notNull(),
  weightHg: integer("weight_hg").notNull(),
  baseExperience: integer("base_experience").notNull(),
  // Own stats at level 1 and at the max level, without the class; levels in between are computed
  baseStats: jsonb("base_stats").$type<PokemonStats>().notNull(),
  maxStats: jsonb("max_stats").$type<PokemonStats>().notNull(),
  // Current level and class (src/shared/character/classes.ts); class_tier backs the divine index
  level: integer("level").notNull(),
  class: text("class").notNull(),
  classTier: text("class_tier").$type<ClassTier>().notNull(),
  archetype: text("archetype").$type<Archetype>().notNull(),
  seed: bigint("seed", { mode: "number" }).notNull(),
  modelVersion: integer("model_version").notNull(),
  // What the character was generated from; with seed and the same model version it reproduces the character
  request: jsonb("request").$type<CharacterInputType>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, table => [
  // Only one character may hold a divine class at a time, like in FW
  uniqueIndex("generated_character_divine_class_unique").on(table.class).where(sql`class_tier = 'divine'`)
])
