import EnhancedMuseumRouteResponsive from '@/components/enhanced-museum-route-responsive'

async function getMuseums() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/museums`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error('Failed to fetch museums')
  }
  return res.json()
}

export default async function Home() {
  const initialMuseums = await getMuseums()
  return <EnhancedMuseumRouteResponsive initialMuseums={initialMuseums} />
}
