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
  const mode = params.mode || 'replay'

  return <MapPageClient flightParam={flightParam} mode={mode} />
}
