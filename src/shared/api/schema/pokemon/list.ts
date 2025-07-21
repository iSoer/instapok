import { z } from "zod"
import { infiniteRequest } from "../pagination"
import { tagResponseItem } from "./tags"

export const listItem = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  alt: z.string().nullable(),
  tags: z.array(tagResponseItem).nullish()
})

export const listResponseSchema = z.array(listItem)

export const listRequestSchema = z.object({
  tags: z.array(z.string()).nullish()
}).merge(infiniteRequest)

export type ListResponseType = z.infer<typeof listResponseSchema>

export type ListResponseItemType = z.infer<typeof listItem>

export type ListRequestType = z.infer<typeof listRequestSchema>
