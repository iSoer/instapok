"use client"
import { usePokemonBank } from "@api/hooks/usePokemonBank"
import { useCallback, useMemo, useRef, useState } from "react"

import { Sidebar, type FormType, SidebarOnChangeValues } from "@components/layout/Sidebar"
import { Layout } from "@components/layout/Layout"

import { InstagramCardItemType } from "@components/instagram-infinite-scroll/InstagramCardSlide"
import {
  InstagramInfiniteScrollSlider,
  InstagramInfiniteScrollSliderForwardRefType
} from "@components/instagram-infinite-scroll/InstagramInfiniteScrollSlider"

export default function Home() {
  const sliderRef = useRef<HTMLDivElement & InstagramInfiniteScrollSliderForwardRefType>(null)

  const [
    form,
    setForm
  ] = useState<FormType>({
    tags: []
  })

  const {
    data,
    setSize,
    isLoading,
    isLoadingMore,
    error
  } = usePokemonBank({
    page: 0,
    limit: 20,
    tags: form.tags
  })

  const itemList = useMemo(() => {
    if (!data || isLoading) {
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

  const onSidebarDataChange = useCallback(({
    tags
  }: SidebarOnChangeValues) => {
    setForm(prev => ({
      ...prev,
      ...(tags && { tags })
    }))
    if (tags) {
      setSize(1)
    }

    sliderRef.current?.scrollToTop()
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
        onChange={onSidebarDataChange}
      />
      <section>
        <InstagramInfiniteScrollSlider
          ref={sliderRef}
          loading={isLoading || isLoadingMore}
          items={itemList}
          onLastItemShowed={onLastItemShowed}
        />
      </section>
    </Layout>
  )
}
