import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { SerwistProvider } from "@serwist/turbopack/react"
import { ServiceWorkerDevCleanup } from "@components/pwa/ServiceWorkerDevCleanup"
import { InstallPrompt } from "@components/pwa/InstallPrompt"
import "./style/style.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
})

export const metadata: Metadata = {
  title: "Instapoke",
  description: "Instagram-style feed of Pokémon sprites",
  applicationName: "Instapoke",
  appleWebApp: {
    capable: true,
    title: "Instapoke",
    statusBarStyle: "black-translucent"
  },
  icons: {
    apple: "/icons/apple-touch-icon.png"
  },
  formatDetection: {
    telephone: false
  }
}

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  viewportFit: "cover"
}

// The worker is served from /serwist/sw.js but controls the whole app (the route sends Service-Worker-Allowed: /)
const swOptions: RegistrationOptions = { scope: "/", updateViaCache: "none" }

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* reloadOnOnline would reset the feed; cacheOnNavigation is pointless for a single page */}
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV !== "production"}
          options={swOptions}
          reloadOnOnline={false}
          cacheOnNavigation={false}
        >
          {children}
          <InstallPrompt />
        </SerwistProvider>
        <ServiceWorkerDevCleanup />
      </body>
    </html>
  )
}
