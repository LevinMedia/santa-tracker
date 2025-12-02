import MapPageClient from './MapPageClient'

interface MapPageProps {
  searchParams: Promise<{
    flight?: string
  }>
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const params = await searchParams
  const flightParam = params.flight || '2024_santa_tracker_weather'

  return <MapPageClient flightParam={flightParam} />
}
