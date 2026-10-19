import { z } from "zod"
import { infiniteResponse, infiniteRequest } from "../pagination"
import { tagResponseItem } from "./tags"

export const listItem = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  alt: z.string().nullable(),
  tags: z.array(tagResponseItem).nullish()
})

export const listResponseSchema = z.object({
  data: z.array(listItem),
  pagination: infiniteResponse
})

export const MAX_TAGS = 50

/**
 * Tag ids from the query string (`?tags=<uuid>&tags=<uuid>`).
 * Empty values mean "no tag filter" (the client sends `tags=` when nothing is selected),
 * duplicates are dropped, anything else that is not a UUID is rejected.
 */
const tagsParam = z.preprocess(
  value => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]),
  z
    .array(z.string())
    .transform(tags => [...new Set(tags.filter(tag => tag !== ""))])
    .pipe(z.array(z.string().uuid()).max(MAX_TAGS))
)

export const listRequestSchema = z.object({
  tags: tagsParam
}).merge(infiniteRequest)

export type ListResponseType = z.infer<typeof listResponseSchema>

export type ListResponseItemType = z.infer<typeof listItem>

export type ListRequestType = z.infer<typeof listRequestSchema>
