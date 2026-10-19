import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ServiceWorkerRegister } from "@components/pwa/ServiceWorkerRegister"
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
        {children}
        <InstallPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
