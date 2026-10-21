import type { Metadata } from "next"
import { GameClient } from "./GameClient"

export const metadata: Metadata = {
  title: "Пушистая Резня",
  description: "Тактическая игра про котиков и собачек. Бойцы — персонажи модели генерации: редкость, уровни 1-80, классы FW."
}

export default function GamePage() {
  return <GameClient />
}
