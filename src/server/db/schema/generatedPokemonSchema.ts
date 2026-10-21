import { pgTable, uuid, text, timestamp, integer, jsonb, bigint, type AnyPgColumn } from "drizzle-orm/pg-core"
import type { Archetype, GenerationInputType, PokemonClass } from "@shared/api/schema/pokemon/generated"
import type { PokemonStats } from "./pokemonInfoSchema"

// Pokemon made by the generator (src/server/pokemon-model, docs/pokemon-model.md); not linked to sprites
export const generatedPokemonSchema = pgTable("generated_pokemon", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Also must not clash with pokemon_info.name, checked when saving
  name: text("name").notNull().unique(),
  types: text("types").array().notNull(),
  // ability.name values of ability_source_id, in slot order; no FK, arrays cannot have one
  abilities: text("abilities").array().notNull(),
  abilitySourceId: integer("ability_source_id").notNull(),
  // PokeAPI units: decimetres and hectograms
  heightDm: integer("height_dm").notNull(),
  weightHg: integer("weight_hg").notNull(),
  baseExperience: integer("base_experience").notNull(),
  stats: jsonb("stats").$type<PokemonStats>().notNull(),
  class: text("class").$type<PokemonClass>().notNull(),
  stageIndex: integer("stage_index"),
  stageOf: integer("stage_of"),
  archetype: text("archetype").$type<Archetype>().notNull(),
  // Previous evolution stage, or the base pokemon of a form
  parentId: uuid("parent_id").references((): AnyPgColumn => generatedPokemonSchema.id, { onDelete: "set null" }),
  form: text("form").$type<"mega">(),
  seed: bigint("seed", { mode: "number" }).notNull(),
  modelVersion: integer("model_version").notNull(),
  // What the pokemon was generated from; with seed and the same model version it reproduces the pokemon
  request: jsonb("request").$type<GenerationInputType>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})
