import MapPageClient from './MapPageClient'

interface MapPageProps {
  searchParams: {
    flight?: string
  }
}

export default function MapPage({ searchParams }: MapPageProps) {
  const flightParam = searchParams.flight || 'test-flight-1'

  return <MapPageClient flightParam={flightParam} />
}
