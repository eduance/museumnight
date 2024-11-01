"use client"

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Museum {
  id: number
  name: string
  address: string
  coords: {
    lat: number
    lng: number
  }
  distance?: number
}

interface MapComponentProps {
  museums: Museum[]
  selectedMuseums: Museum[]
  isAnimating: boolean
  optimalPath: Museum[]
}

const museumIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const damSquareIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c
  return d
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180)
}

export default function MapComponent({ museums, selectedMuseums, isAnimating, optimalPath }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const polylineRef = useRef<L.Polyline | null>(null)
  const animatedMarkerRef = useRef<L.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !mapRef.current) {
      mapRef.current = L.map('map').setView([52.373055, 4.892222], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current)
      setMapLoaded(true)
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Add new markers
    museums.forEach((museum) => {
      if (museum.coords && museum.coords.lat && museum.coords.lng) {
        const marker = L.marker([museum.coords.lat, museum.coords.lng], {
          icon: museum.id === 0 ? damSquareIcon :
            (selectedMuseums.some(m => m.id === museum.id) ? selectedIcon : museumIcon)
        }).addTo(mapRef.current!)
        marker.bindPopup(`${museum.name}<br/>${museum.address}`)
        markersRef.current.push(marker)
      }
    })

    // Fit bounds to show all markers
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current)
      mapRef.current.fitBounds(group.getBounds().pad(0.1))
    }
  }, [museums, selectedMuseums, mapLoaded])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return

    if (polylineRef.current) {
      polylineRef.current.remove()
      polylineRef.current = null
    }

    if (animatedMarkerRef.current) {
      animatedMarkerRef.current.remove()
      animatedMarkerRef.current = null
    }

    if (isAnimating && optimalPath.length > 1) {
      const pathCoords = optimalPath.map(museum => [museum.coords.lat, museum.coords.lng])
      polylineRef.current = L.polyline(pathCoords as L.LatLngExpression[], { color: 'red', weight: 3 }).addTo(mapRef.current)

      // Smooth zoom animation
      const bounds = polylineRef.current.getBounds()
      mapRef.current.flyToBounds(bounds, {
        padding: [50, 50],
        duration: 1,  // Duration in seconds
        easeLinearity: 0.5
      })

      const animatedIcon = L.divIcon({
        className: 'animated-icon',
        html: '<div style="background-color: blue; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      })

      animatedMarkerRef.current = L.marker(pathCoords[0] as L.LatLngExpression, { icon: animatedIcon }).addTo(mapRef.current)

      let currentIndex = 0
      const animateMarker = () => {
        if (currentIndex < pathCoords.length - 1) {
          const start = pathCoords[currentIndex] as [number, number]
          const end = pathCoords[currentIndex + 1] as [number, number]
          const duration = calculateDistance(start[0], start[1], end[0], end[1]) * 200 // 200ms per km, faster animation

          const frames = 60
          const latStep = (end[0] - start[0]) / frames
          const lngStep = (end[1] - start[1]) / frames
          let frame = 0

          const moveFrame = () => {
            if (frame < frames) {
              const lat = start[0] + latStep * frame
              const lng = start[1] + lngStep * frame
              animatedMarkerRef.current?.setLatLng([lat, lng])
              frame++
              requestAnimationFrame(moveFrame)
            } else {
              currentIndex++
              if (currentIndex < pathCoords.length - 1) {
                animateMarker()
              }
            }
          }

          moveFrame()
        }
      }

      animateMarker()
    } else if (!isAnimating) {
      // Reset zoom when animation stops
      const allMarkers = L.featureGroup(markersRef.current)
      mapRef.current.flyToBounds(allMarkers.getBounds().pad(0.1), {
        duration: 1,
        easeLinearity: 0.5
      })
    }
  }, [isAnimating, optimalPath, mapLoaded])

  return <div id="map" style={{ height: '100%', width: '100%' }} />
}
