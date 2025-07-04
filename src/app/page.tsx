"use client"
import { usePokemonBank } from "@api/hooks/usePokemonBank"
import { useCallback, useMemo, useRef, useState } from "react"
import { twMerge } from "@lib/tailwind-merge"

import { Sidebar, type FormType, SidebarOnChangeValues } from "@components/layout/Sidebar"
import { Layout } from "@components/layout/Layout"

import { InstagramSlider } from "@components/instagram-slider/InstagramSlider"
import { InstagramCardItemType, InstagramCardSlide } from "@components/instagram-slider/InstagramCardSlide"
import { Loader } from "@components/ui/Loader"

export default function Home() {
  const [
    form,
    setForm
  ] = useState<FormType>({
    tags: [],
    sliderHeight: 500,
    sliderWidth: 350,
    slideGapY: 20,
    containerPaddingY: 40,
    overScan: 10,
    disableSnapMandatory: false,
    fullScreen: false
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

    return data.reduce<InstagramCardItemType[]>((acc, datum) => {
      return [
        ...acc,
        ...datum.data.map((item) => {
          return {
            ...item,
            url: `/uploads/pokemon/images/${item.name}.webp`,
            thumbnailUrl: `/uploads/pokemon/thumbnails/${item.name}.thumbnail.webp`
          }
        })
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
      <InstagramCardSlide
        itemWidth={form.sliderWidth}
        itemHeight={itemHeight}
        item={pokemon}
        index={index}
      />
    )
  }, [form.sliderWidth, itemList])

  const onSidebarDataChange = useCallback(({
    tags,
    sliderHeight,
    sliderWidth,
    slideGapY,
    containerPaddingY,
    disableSnapMandatory,
    overScan,
    fullScreen
  }: SidebarOnChangeValues) => {
    setForm(prev => ({
      ...prev,
      ...(tags && { tags }),
      ...(sliderHeight && { sliderHeight }),
      ...(sliderWidth && { sliderWidth }),
      ...(slideGapY && { slideGapY }),
      ...(containerPaddingY && { containerPaddingY }),
      ...(overScan && { overScan }),

      ...(typeof disableSnapMandatory !== "undefined" && { disableSnapMandatory }),
      ...(typeof fullScreen !== "undefined" && { fullScreen })
    }))
    if (tags) {
      setSize(0)
    }
  }, [setSize])

  if (error) {
    return (
      <Layout>
        <div className="flex w-full h-full items-center justify-center">
          Something went wrong :c
        </div>
      </Layout>
    )
  }

  return (
    <Layout withSidebar>
      <Sidebar
        initialValues={initialSidebarValues}
        onChange={onSidebarDataChange}
      />
      <section className="flex items-center justify-center relative">
        {
          isLoadingMore
          && <Loader className={twMerge("absolute top-0 left-0")} />
        }
        <InstagramSlider
          itemsCount={itemList.length}
          renderItem={renderItem}
          initialLoading={isLoading}
          onLastItemShowed={onLastItemShowed}

          fullScreen={form.fullScreen}
          itemHeight={form.sliderHeight}
          overScan={form.overScan}
          slideGapY={form.slideGapY}
          containerPaddingY={form.containerPaddingY}
          disableSnapMandatory={form.disableSnapMandatory}
        />
      </section>
    </Layout>
  )
}
