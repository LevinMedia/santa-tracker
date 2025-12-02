import { track } from '@vercel/analytics'

export const trackCommandClick = (key: string, label: string) => {
  track('command_menu_click', { key, label })
}

export const trackFlightSelected = (year: number, filename: string) => {
  track('flight_selected', { year, filename })
}
