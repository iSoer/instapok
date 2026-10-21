import { z } from "zod"

export const abilityItem = z.object({
  // Link key: the values stored in pokemon_info.abilities; unique per source
  name: z.string(),
  // 0 = PokeAPI (INFO_SOURCES in src/server/pokemon-info/sources.ts)
  sourceId: z.number().int(),
  // Id in the source service, informational
  externalId: z.number().int(),
  displayName: z.string().nullable(),
  effect: z.string().nullable(),
  shortEffect: z.string().nullable(),
  flavorText: z.string().nullable(),
  generation: z.string(),
  isMainSeries: z.boolean()
})

export const abilitiesResponseSchema = z.object({
  data: z.array(abilityItem)
})

export type AbilitiesResponseType = z.infer<typeof abilitiesResponseSchema>

export type AbilityItemType = z.infer<typeof abilityItem>
