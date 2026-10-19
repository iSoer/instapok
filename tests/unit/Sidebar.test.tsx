// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Sidebar, type FormType } from "@components/layout/Sidebar"

const TAGS = [
  { id: "b-id", name: "shiny" },
  { id: "a-id", name: "legendary" }
]

vi.mock("@api/hooks/usePokemonTags", () => ({
  usePokemonTags: () => ({ data: { data: TAGS }, isLoading: false })
}))

const INITIAL_VALUES: FormType = {
  tags: [],
  sliderHeight: 500,
  sliderWidth: 350,
  slideGapY: 20,
  containerPaddingY: 40,
  overScan: 10,
  disableSnapMandatory: false,
  fullScreen: false
}

const setup = (initialValues: Partial<FormType> = {}) => {
  const onChange = vi.fn()
  render(<Sidebar initialValues={{ ...INITIAL_VALUES, ...initialValues }} onChange={onChange} />)

  return { onChange }
}

describe("Sidebar tag selection", () => {
  afterEach(cleanup)

  it("renders a checkbox per tag", () => {
    setup()

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[]

    expect(checkboxes).toHaveLength(TAGS.length)
    expect(checkboxes.every(checkbox => !checkbox.checked)).toBe(true)
  })

  it("emits every selected tag, sorted regardless of click order", () => {
    const { onChange } = setup()

    fireEvent.click(screen.getByRole("checkbox", { name: "shiny" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "legendary" }))

    expect(onChange).toHaveBeenNthCalledWith(1, { tags: ["b-id"] })
    expect(onChange).toHaveBeenNthCalledWith(2, { tags: ["a-id", "b-id"] })
  })

  it("emits an empty array once everything is deselected", () => {
    const { onChange } = setup()
    const shiny = screen.getByRole("checkbox", { name: "shiny" })

    fireEvent.click(shiny)
    fireEvent.click(shiny)

    expect(onChange).toHaveBeenLastCalledWith({ tags: [] })
  })

  it("starts from the initial selection", () => {
    const { onChange } = setup({ tags: ["a-id"] })

    expect((screen.getByRole("checkbox", { name: "legendary" }) as HTMLInputElement).checked).toBe(true)

    fireEvent.click(screen.getByRole("checkbox", { name: "shiny" }))

    expect(onChange).toHaveBeenLastCalledWith({ tags: ["a-id", "b-id"] })
  })
})
