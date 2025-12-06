import { FLIGHT_END, FLIGHT_START, LIVE_FLIGHT_FILE } from '@/lib/flight-window'
import MapPageClient from './MapPageClient'

interface MapPageProps {
  searchParams: Promise<{
    flight?: string
    mode?: 'replay' | 'live'
  }>
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const params = await searchParams
  const flightParam = params.flight || '2024_santa_tracker_weather'
  const isLiveFlight = flightParam === LIVE_FLIGHT_FILE
  const inLiveWindow = Date.now() >= FLIGHT_START && Date.now() <= FLIGHT_END

  const mode = params.mode === 'live' && isLiveFlight && !inLiveWindow ? 'replay' : params.mode || 'replay'

  return <MapPageClient flightParam={flightParam} mode={mode} />
}
