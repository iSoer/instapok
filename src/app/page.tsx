"use client"
import { usePokemonBank } from "@api/hooks/usePokemonBank"
import { InstagramSlider } from "@ui/InstagramSlider"
import { useCallback, useMemo, useRef, useState } from "react"
import { ListResponseItemType } from "@shared/api/schema/pokemon/list"
import { twMerge } from "@lib/tailwind-merge"
import { Sidebar, type FormType } from "@ui/Sidebar"
import { InstagramImageSlide } from "@ui/InstagramImageSlide"
import { Loader } from "@ui/Loader"

export default function Home() {
  const [
    form,
    setForm
  ] = useState<FormType>({
    tags: [],
    sliderHeight: 500,
    sliderWidth: 350,
    slideGapY: 20,
    containerPaddingY: 40
  })

  const { current: initialSidebarValues } = useRef(form)

  const {
    data,
    setSize,
    isLoading,
    size,
    error
  } = usePokemonBank({ page: 0, limit: 20, tags: form.tags })

  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === "undefined")

  const itemList = useMemo(() => {
    if (!data) {
      return []
    }

    return data.reduce<ListResponseItemType[]>((acc, item) => {
      return [
        ...acc,
        ...item.data
      ]
    }, [])
  }, [data])

  const onLastItemShowed = useCallback(() => {
    if (!isLoading && !error) {
      setSize(size => size + 1)
    }
  }, [error, isLoading, setSize])

  const renderItem = useCallback((index: number, itemHeight: number) => {
    const pokemon = itemList?.[index]

    if (!pokemon) {
      return <div>Pokemon not found :c</div>
    }

    return (
      <InstagramImageSlide
        itemWidth={form.sliderWidth}
        itemHeight={itemHeight}
        item={pokemon}
        index={index}
      />
    )
  }, [form.sliderWidth, itemList])

  return (
    <main
      className={twMerge(
        "grid grid-cols-[300px_1fr]",
        "h-dvh"
      )}
    >
      {
        (() => {
          if (error) {
            return (
              <div className="flex w-full h-full items-center justify-center">
                Something went wrong :c
              </div>
            )
          }
          return (
            <>
              <Sidebar
                initialValues={initialSidebarValues}
                onChange={({ tags, sliderHeight, sliderWidth }) => {
                  setForm(prev => ({
                    ...prev,
                    ...(tags && { tags }),
                    ...(sliderHeight && { sliderHeight }),
                    ...(sliderWidth && { sliderWidth })
                  }))
                  if (tags) {
                    setSize(0)
                  }
                }}
              />
              <section className="flex items-center justify-center relative">
                { isLoadingMore && <Loader className={twMerge("absolute top-0 left-0")} />}
                <InstagramSlider
                  isLoading={isLoading}
                  onLastItemShowed={onLastItemShowed}
                  itemHeight={form.sliderHeight}
                  overScan={2}
                  slideGapY={form.slideGapY}
                  containerPaddingY={form.containerPaddingY}
                  itemsCount={itemList.length}
                  renderItem={renderItem}
                />
              </section>
            </>
          )
        })()
      }
    </main>
  )
}
