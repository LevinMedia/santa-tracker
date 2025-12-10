import { track } from '@vercel/analytics'

const COMMAND_EVENT_NAMES: Record<string, string> = {
  L: 'command_menu_click_live_now',
  R: 'command_menu_click_watch_previous_replay',
  P: 'command_menu_click_poppa_elf',
  D: 'command_menu_click_donate',
  S: 'command_menu_click_share',
  A: 'command_menu_click_about',
  '5': 'command_menu_click_watch_current_replay',
  Q: 'command_menu_click_quit',
}

export const trackCommandClick = (key: string, label: string) => {
  const eventName = COMMAND_EVENT_NAMES[key] ?? 'command_menu_click_other'
  track(eventName, { key, label })
}

export const trackFlightSelected = (year: number, filename: string) => {
  track('flight_selected', { year, filename })
}

export const trackPageView = (path: string, params?: Record<string, string>) => {
  // Build full path with query parameters for better analytics tracking
  const fullPath = params && Object.keys(params).length > 0
    ? `${path}?${new URLSearchParams(params).toString()}`
    : path
  
  track('page_view', { 
    path: fullPath,
    ...params 
  })
}
