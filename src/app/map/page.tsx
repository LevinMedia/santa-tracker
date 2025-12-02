import MapPageClient from './MapPageClient'

interface MapPageProps {
  searchParams: {
    flight?: string
  }
}

export default function MapPage({ searchParams }: MapPageProps) {
  const flightParam = searchParams.flight || '2024_santa_tracker'

  return <MapPageClient flightParam={flightParam} />
}
