export type VercelAnalyticsEvent = {
  action: "event"
  name: string
  payload?: Record<string, unknown>
}

declare global {
  interface Window {
    va?: (action: VercelAnalyticsEvent["action"], name: string, payload?: VercelAnalyticsEvent["payload"]) => void
    vaq?: [VercelAnalyticsEvent["action"], string, VercelAnalyticsEvent["payload"]?][]
  }
}

const queueEvent = (name: string, payload?: VercelAnalyticsEvent["payload"]) => {
  if (typeof window === "undefined") return

  if (typeof window.va === "function") {
    window.va("event", name, payload)
    return
  }

  window.vaq = window.vaq || []
  window.vaq.push(["event", name, payload])
}

export const trackCommandClick = (key: string, label: string) => {
  queueEvent("command_menu_click", { key, label })
}
