/** "1", "4-7" → numbers; throws on anything else */
export const parseIds = (args: string[]) => args.flatMap((arg) => {
  const match = /^(\d+)(?:-(\d+))?$/.exec(arg)

  if (!match) {
    throw new Error(`Invalid id or range: "${arg}"`)
  }

  const from = Number(match[1])
  const to = Number(match[2] ?? match[1])

  if (from > to) {
    throw new Error(`Invalid range: "${arg}"`)
  }

  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
})
