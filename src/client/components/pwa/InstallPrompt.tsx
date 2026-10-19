"use client"
import { memo, useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { twMerge } from "@lib/tailwind-merge"

// Chromium-only event, not in lib.dom
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const subscribeNoop = () => () => {}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && navigator.standalone === true)
}

// iOS never fires beforeinstallprompt: installing is only possible through Share → "Add to Home Screen"
function isIosBrowser() {
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)

  return isIos && !isStandalone()
}

export const InstallPrompt = memo(function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const showIosHint = useSyncExternalStore(subscribeNoop, isIosBrowser, () => false)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Keep the event to show our own button instead of the browser mini-infobar
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }

    const onInstalled = () => setInstallEvent(null)

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!installEvent) {
      return
    }

    await installEvent.prompt()
    await installEvent.userChoice
    // A prompt event can be used only once
    setInstallEvent(null)
  }, [installEvent])

  const dismiss = useCallback(() => setDismissed(true), [])

  if (dismissed || (!installEvent && !showIosHint)) {
    return null
  }

  return (
    <div
      role="dialog"
      aria-label="Install Instapoke"
      className={twMerge(
        "fixed bottom-16 right-16 left-16 z-50 sm:left-auto sm:max-w-320",
        "flex items-center gap-12 p-12 rounded-lg",
        "bg-neutral-800 text-sm material-shadow"
      )}
    >
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="shrink-0" />
      <div className="grow">
        {
          installEvent
            ? "Install Instapoke on your device"
            : <>To install, tap Share and then &laquo;Add to Home Screen&raquo;</>
        }
      </div>
      {
        installEvent
        && (
          <button
            type="button"
            onClick={install}
            className="shrink-0 px-12 py-6 rounded-md bg-red-700 hover:bg-red-600 cursor-pointer"
          >
            Install
          </button>
        )
      }
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close"
        className="shrink-0 px-6 text-neutral-400 hover:text-neutral-100 cursor-pointer"
      >
        ✕
      </button>
    </div>
  )
})
