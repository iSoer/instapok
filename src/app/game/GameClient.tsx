"use client"
import dynamic from "next/dynamic"

// The game reads window, localStorage and the URL hash at import time, so it never renders on the server
const GameRoot = dynamic(() => import("@game/GameRoot"), { ssr: false })

export function GameClient() {
  return <GameRoot />
}
