import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { Select } from "@components/ui/Select"
import { usePokemonTags } from "@api/hooks/usePokemonTags"

export type FormType = {
  tags: string[]
}

export type SidebarOnChangeValues = Partial<FormType>

export type SidebarPropsType = {
  onChange: (values: SidebarOnChangeValues) => void
}

export const Sidebar = memo(function Sidebar({ onChange }: SidebarPropsType) {
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
      </div>
    </aside>
  )
})
