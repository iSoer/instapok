import type {
  CustomPokemonType, GeneratedPokemonType, GenerateRequestType, SavedGeneratedPokemonType
} from "@shared/api/schema/pokemon/generated"

export type GeneratorBody
  = | { mode: "custom", pokemon: CustomPokemonType, seed?: number }
    | { mode: "single", request: GenerateRequestType, seed?: number }

export type GeneratorResult<T>
  = | { ok: true, data: T[] }
  // violations: what the generator or the validator rejected, ready to show
    | { ok: false, status: number, error: string, violations: string[] }

/**
 * POST to the generator. Unlike fetchFn it keeps the error body: 400 and 409 carry the
 * violations / taken names the page shows next to the form.
 */
export const postGenerator = async <T, B = GeneratorBody>(
  url: string,
  body: B,
  signal?: AbortSignal
): Promise<GeneratorResult<T>> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal
  })
  const json = await response.json().catch(() => ({})) as { data?: T[], error?: string, violations?: string[], names?: string[] }

  if (response.ok && json.data) {
    return { ok: true, data: json.data }
  }

  return {
    ok: false,
    status: response.status,
    error: json.error ?? `Request failed with ${response.status}`,
    violations: json.violations ?? json.names?.map(name => `Name "${name}" is already taken`) ?? []
  }
}

export const previewPokemon = (body: GeneratorBody, signal?: AbortSignal) => postGenerator<GeneratedPokemonType>(
  "/api/pokemon/generated/preview",
  body,
  signal
)

export const savePokemon = (body: GeneratorBody) => postGenerator<SavedGeneratedPokemonType>("/api/pokemon/generated", body)
