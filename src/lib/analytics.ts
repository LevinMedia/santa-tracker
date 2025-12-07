import { track } from '@vercel/analytics'

export const trackCommandClick = (key: string, label: string) => {
  track('command_menu_click', { key, label })
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
