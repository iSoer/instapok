import { z } from "zod"

export const tagResponseItem = z.object({
  id: z.string(),
  name: z.string()
})

export const tagsResponse = z.object({
  data: z.array(tagResponseItem)
})

export type ListResponseType = z.infer<typeof tagsResponse>
