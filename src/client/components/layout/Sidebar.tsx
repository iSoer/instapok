import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { Select } from "@components/ui/Select"
import { Input } from "@components/ui/Input"
import { Toggle } from "@components/ui/Toggle"
import { usePokemonTags } from "@api/hooks/usePokemonTags"

export type FormType = {
  tags: string[]
  sliderHeight: number
  sliderWidth: number
  slideGapY: number
  containerPaddingY: number
  overScan: number
  disableSnapMandatory: boolean
}

export type SidebarOnChangeValues = Partial<FormType>

export type SidebarPropsType = {
  initialValues: FormType
  onChange: (values: SidebarOnChangeValues) => void
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
      <div
        className={twMerge(
          "flex flex-col gap-12"
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
          label="Slide width:"
          type="number"
          defaultValue={initialValues.sliderWidth}
          onChange={(event) => {
            const sliderWidth = Number(event.currentTarget.value)
            if (sliderWidth > 0) {
              onChange({
                sliderWidth
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
          label="Slider item height:"
          type="number"
          defaultValue={initialValues.sliderHeight}
          onChange={(event) => {
            const sliderHeight = Number(event.currentTarget.value)
            if (sliderHeight > 0) {
              onChange({
                sliderHeight
              })
            }
          }}
        />
        <Input
          label="Slider slide gap y:"
          type="number"
          defaultValue={initialValues.slideGapY}
          onChange={(event) => {
            const slideGapY = Number(event.currentTarget.value)
            if (slideGapY > 0) {
              onChange({
                slideGapY
              })
            }
          }}
        />
        <Input
          label="Slider container padding y:"
          type="number"
          defaultValue={initialValues.containerPaddingY}
          onChange={(event) => {
            const containerPaddingY = Number(event.currentTarget.value)
            if (containerPaddingY > 0) {
              onChange({
                containerPaddingY
              })
            }
          }}
        />
        <Input
          label="Slider overscan:"
          type="number"
          min="2"
          defaultValue={initialValues.overScan}
          onChange={(event) => {
            const overScan = Number(event.currentTarget.value)
            if (overScan > 2) {
              onChange({
                overScan
              })
            }
          }}
        />
        <div className="flex items-center gap-8">
          <div>Disable snap mandatory:</div>
          <Toggle
            defaultValue={initialValues.disableSnapMandatory}
            ariaLabel="Toggle scroll mode"
            onToggle={(checked) => {
              onChange({
                disableSnapMandatory: checked
              })
            }}
          />
        </div>
      </div>
    </aside>
  )
})
