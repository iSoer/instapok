import { twMerge } from "@lib/tailwind-merge"
import { memo, ReactNode } from "react"

export const Layout = memo(function Layout({ withSidebar, children }: { withSidebar?: boolean, children: ReactNode }) {
  return (
    <main
      className={twMerge(
        "grid",
        "h-dvh",
        withSidebar ? "grid-cols-[300px_1fr]" : ""
      )}
    >
      {children}
    </main>
  )
})
