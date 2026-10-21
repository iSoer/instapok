// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SWRConfig } from "swr"
import { loadModel } from "@/server/pokemon-model/loadModel"
import { toPublicModel } from "@/server/pokemon-model/publicModel"
import { PokemonGenerator } from "@components/pokemon-generator/PokemonGenerator"
import type { GeneratorBody } from "@api/generator"

const previewPokemon = vi.fn()
const savePokemon = vi.fn()

vi.mock("@api/generator", () => ({
  previewPokemon: (...args: unknown[]) => previewPokemon(...args),
  savePokemon: (...args: unknown[]) => savePokemon(...args)
}))

vi.mock("@api/hooks/useRecentGeneratedPokemon", () => ({
  RECENT_GENERATED_URL: "/recent",
  useRecentGeneratedPokemon: () => ({ data: { data: [], pagination: { count: 0, total: 0 } }, isLoading: false })
}))

const model = toPublicModel(loadModel())

const slider = (label: string) => screen.getByLabelText(label) as HTMLInputElement

const remaining = () => Number(/Remaining (-?\d+)/.exec(screen.getByText(/^Remaining/).textContent ?? "")![1])

const setup = () => render(
  <SWRConfig value={{ provider: () => new Map() }}>
    <PokemonGenerator model={model} descriptions={new Map()} />
  </SWRConfig>
)

beforeEach(() => {
  // Echo the hand-made pokemon back as the server would
  previewPokemon.mockImplementation(async (body: GeneratorBody) => (body.mode === "custom"
    ? {
        ok: true,
        data: [{
          ...body.pokemon,
          name: "testmon",
          stage: body.pokemon.stage ?? null,
          heightDm: 10,
          weightHg: 100,
          baseExperience: 100,
          archetype: "balanced",
          form: null,
          seed: body.seed,
          modelVersion: 1,
          input: body,
          explain: []
        }]
      }
    : { ok: false, status: 400, error: "not mocked", violations: [] }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("PokemonGenerator", () => {
  it("blocks raising a stat once the budget is spent and frees points when another goes down", () => {
    setup()

    const attack = slider("Attack")
    const before = Number(attack.value)

    expect(remaining()).toBeLessThan(5)

    fireEvent.change(attack, { target: { value: String(before + 50) } })

    expect(Number(slider("Attack").value)).toBe(before)
    expect(screen.getAllByText(/Budget spent: free points/).length).toBeGreaterThan(0)

    const speed = slider("Speed")

    fireEvent.change(speed, { target: { value: String(Number(speed.value) - 30) } })

    expect(remaining()).toBeGreaterThanOrEqual(30)

    fireEvent.change(slider("Attack"), { target: { value: String(before + 30) } })

    expect(Number(slider("Attack").value)).toBe(before + 30)
    expect(remaining()).toBeLessThan(5)
  })

  it("offers the abilities of the chosen type and checks the pokemon with the server", async () => {
    setup()

    expect(screen.getByText(/Pick a type to see/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Fire" }))
    fireEvent.click(screen.getByRole("button", { name: /^Blaze/ }))

    expect(screen.queryByRole("button", { name: /^Torrent/ })).toBeNull()

    await waitFor(() => expect(previewPokemon).toHaveBeenCalled())

    const [body] = previewPokemon.mock.calls.at(-1)! as [GeneratorBody]

    expect(body).toMatchObject({ mode: "custom", pokemon: { types: ["fire"], abilities: ["blaze"] } })
    expect(await screen.findByText("Testmon")).toBeTruthy()
    expect((screen.getByRole("button", { name: "Save pokemon" }) as HTMLButtonElement).disabled).toBe(false)
  })

  it("caps attack and shows its doubled value with huge-power", () => {
    setup()

    fireEvent.click(screen.getByRole("button", { name: "Water" }))
    fireEvent.click(screen.getByRole("button", { name: /Huge Power/ }))

    const attackBlock = slider("Attack").closest("div")!.parentElement!

    expect(within(attackBlock).getByText(/capped by huge-power/)).toBeTruthy()
    expect(within(attackBlock).getByText(/in battle/)).toBeTruthy()
    expect(screen.getByText(/doubles Attack/)).toBeTruthy()
  })
})
