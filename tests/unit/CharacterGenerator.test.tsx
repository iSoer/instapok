// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SWRConfig } from "swr"
import { buildCustomCharacter } from "@/server/character-model/generate"
import { loadCharacterModel } from "@/server/character-model/model"
import { toPublicCharacterModel } from "@/server/character-model/publicModel"
import { CharacterGenerator } from "@components/character-generator/CharacterGenerator"
import type { CharacterBody } from "@api/characterGenerator"

const previewCharacter = vi.fn()
const saveCharacter = vi.fn()

vi.mock("@api/characterGenerator", () => ({
  previewCharacter: (...args: unknown[]) => previewCharacter(...args),
  saveCharacter: (...args: unknown[]) => saveCharacter(...args)
}))

vi.mock("@api/hooks/useRecentGeneratedCharacters", () => ({
  RECENT_CHARACTERS_URL: "/recent",
  useRecentGeneratedCharacters: () => ({ data: { data: [], pagination: { count: 0, total: 0 } }, isLoading: false })
}))

const serverModel = loadCharacterModel()
const model = toPublicCharacterModel(serverModel)

const setup = () => render(
  <SWRConfig value={{ provider: () => new Map() }}>
    <CharacterGenerator model={model} />
  </SWRConfig>
)

const classButton = (name: string) => screen.getByRole("radio", { name }) as HTMLButtonElement

beforeEach(() => {
  // The real server answer for the hand-made character
  previewCharacter.mockImplementation(async (body: CharacterBody) => (body.mode === "custom"
    ? { ok: true, data: [{ ...buildCustomCharacter(serverModel, body.character, body.seed ?? 1), name: "testchar" }] }
    : { ok: false, status: 400, error: "not mocked", violations: [] }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("CharacterGenerator", () => {
  it("starts at 5★ and moves the budget into the tier of another rarity", () => {
    setup()

    const five = model.rarities[4].budget

    expect(screen.getByRole("radio", { name: "★★★★★" }).getAttribute("aria-checked")).toBe("true")
    expect(screen.getByText(`Tier ${five.min}–${five.max}`)).toBeTruthy()

    fireEvent.click(screen.getByRole("radio", { name: "★" }))

    expect(screen.getByText(`Tier ${model.rarities[0].budget.min}–${model.rarities[0].budget.max}`)).toBeTruthy()
  })

  it("opens classes by talent and level and checks the character with the server", async () => {
    setup()

    expect(screen.getByText("Pick at least one talent")).toBeTruthy()
    expect(classButton("Myrmidon").disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: /^Sword: Normal/ }))
    expect(screen.getByRole("button", { name: /^Sword: Talent, rank D/ })).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/^Level/), { target: { value: "20" } })

    expect(screen.getByRole("button", { name: /^Sword: Talent, rank C/ })).toBeTruthy()
    expect(classButton("Myrmidon").disabled).toBe(false)
    expect(classButton("Archer").disabled).toBe(true)

    fireEvent.click(classButton("Myrmidon"))

    await waitFor(() => expect(previewCharacter).toHaveBeenCalled())

    const [body] = previewCharacter.mock.calls.at(-1)! as [Extract<CharacterBody, { mode: "custom" }>]

    expect(body.character).toMatchObject({ rarity: 5, talents: ["sword"], level: 20, class: "myrmidon" })
    expect(await screen.findByText("Testchar")).toBeTruthy()
    expect(screen.getByText("Lv 20 Myrmidon")).toBeTruthy()
    expect((screen.getByRole("button", { name: "Save character" }) as HTMLButtonElement).disabled).toBe(false)
  })
})
