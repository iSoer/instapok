/** Сейв игры живёт только в localStorage браузера. */
const LOCAL_KEY = "pawfield:save:local"

export function loadLocal(): string | null {
  try {
    return localStorage.getItem(LOCAL_KEY)
  }
  catch {
    return null
  }
}

export function saveLocal(json: string): void {
  try {
    localStorage.setItem(LOCAL_KEY, json)
  }
  catch {
    /* quota or private mode */
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(LOCAL_KEY)
  }
  catch {
    /* ignore */
  }
}
