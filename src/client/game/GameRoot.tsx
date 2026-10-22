"use client"
import { useEffect } from "react"
import { App } from "./ui/App"
import { initRouter } from "./state/router"
import { $battleUi, confirm, endTurn, tapTile, waitHere } from "./state/battleUi"
import { $boardLayout } from "./state/boardLayout"
import { $save, initSave } from "./state/save"
import "./ui/styles.css"

/**
 * Корень игры «Пушистая Резня» на маршруте /game. Только клиент: сейв в localStorage, хеш-роутер и Phaser
 * читают window при импорте, поэтому страница грузит этот модуль через next/dynamic с ssr: false.
 */
export default function GameRoot() {
  useEffect(() => {
    initRouter()
    initSave()
    // Отладочный хук для консоли и смоук-тестов (игра одиночная, секретов нет)
    ;(window as unknown as { __pf?: unknown }).__pf = {
      save: $save,
      ui: $battleUi,
      layout: $boardLayout,
      // Действия игрока в бою — для смоук-тестов и проверки анимаций
      battle: { tapTile, confirm, waitHere, endTurn }
    }
  }, [])

  return (
    <div className="pawfield">
      <App />
    </div>
  )
}
