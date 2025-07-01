import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { Select } from "@ui/Select"
import { Input } from "@ui/Input"
import { usePokemonTags } from "@api/hooks/usePokemonTags"

export type FormType = {
  tags: string[]
  sliderHeight: number
  sliderWidth: number
  slideGapY: number
  containerPaddingY: number
}

export type SidebarPropsType = {
  initialValues: FormType
  onChange: (values: Partial<FormType>) => void
}

export const Sidebar = memo(function Sidebar({ initialValues, onChange }: SidebarPropsType) {
  const {
    data,
    isLoading
  } = usePokemonTags()

  return (
    <aside
      className={twMerge("border-r-1 border-neutral-800", "px-24 pt-24")}
    >
      <ul>
        <li
          className={twMerge(
            "flex flex-col gap-8"
          )}
        >
          <Select
            isLoading={isLoading}
            label="Select poketag:"
            options={data?.data}
            onChange={(event) => {
              onChange({
                tags: event.target.value ? [event.target.value] : []
              })
            }}
          />
          <div
            className={twMerge(
              "border-b-1 border-neutral-800",
              "my-20"
            )}
          />
          <Input
            label="Change slide width:"
            defaultValue={initialValues.sliderWidth}
            onChange={(event) => {
              const sliderWidth = Number(event.currentTarget.value)
              if (sliderWidth > 0) {
                onChange({
                  sliderWidth: sliderWidth
                })
              }
            }}
          />
          <div
            className={twMerge(
              "border-b-1 border-neutral-800",
              "my-20"
            )}
          />
          <Input
            label="Change slider item height:"
            defaultValue={initialValues.sliderHeight}
            onChange={(event) => {
              const sliderHeight = Number(event.currentTarget.value)
              if (sliderHeight > 0) {
                onChange({
                  sliderHeight: sliderHeight
                })
              }
            }}
          />
        </li>
      </ul>
    </aside>
  )
})
