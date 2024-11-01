"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Clock, MapPin } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import dynamic from 'next/dynamic'

const MapComponent = dynamic(() => import('./map-component'), { ssr: false })

interface Museum {
  id: number
  name: string
  address: string
  coords: {
    lat: number
    lng: number
  }
  distance?: number
  uri: string
  image: {
    url: string
    caption: string
  }
  large_image: {
    url: string
    caption: string
  }
  about: string
  notes: string
  capacity: string
  capacity_title: string
}

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

function calculateWalkingTime(distance: number): number {
  const walkingSpeed = 4; // km/h
  const timeInHours = distance / walkingSpeed;
  return Math.round(timeInHours * 60) + 3; // Adding 3 minutes for traffic lights and other delays
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function bruteForceOptimalPath(start: Museum, museums: Museum[]): Museum[] {
  const allPermutations = permute(museums);
  let shortestPath: Museum[] = [];
  let shortestDistance = Infinity;

  for (const permutation of allPermutations) {
    const path = [start, ...permutation];
    const distance = calculateTotalDistance(path);

    if (distance < shortestDistance) {
      shortestDistance = distance;
      shortestPath = path;
    }
  }

  return shortestPath;
}

function permute(arr: Museum[]): Museum[][] {
  if (arr.length <= 1) return [arr];

  return arr.reduce((acc: Museum[][], item: Museum, i: number) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    return acc.concat(permute(rest).map(p => [item, ...p]));
  }, []);
}

function calculateTotalDistance(path: Museum[]): number {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += calculateDistance(
      path[i].coords.lat, path[i].coords.lng,
      path[i + 1].coords.lat, path[i + 1].coords.lng
    );
  }
  return totalDistance;
}

function generateGoogleMapsLink(museums: Museum[]): string {
  if (museums.length < 2) return "";
  const baseUrl = "https://www.google.com/maps/dir/";
  const waypoints = museums.map(museum => museum.coords ? `${museum.coords.lat},${museum.coords.lng}` : '').filter(Boolean);
  // Ensure Dam Square is the starting point
  const damSquare = waypoints.shift();
  return encodeURI(`${baseUrl}${damSquare}/${waypoints.join('/')}`);
}

function estimateTotalTime(path: Museum[]): number {
  let totalTime = 0;
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i].coords && path[i+1].coords) {
      const distance = calculateDistance(
        path[i].coords.lat,
        path[i].coords.lng,
        path[i+1].coords.lat,
        path[i+1].coords.lng
      );
      totalTime += calculateWalkingTime(distance);
      totalTime += 45; // 45 minutes per museum visit
    }
  }
  return totalTime;
}

function generateTimeEstimate(path: Museum[]): string {
  const totalMinutes = estimateTotalTime(path);
  const startTime = new Date();
  startTime.setHours(19, 0, 0, 0); // Set start time to 19:00

  const endTime = new Date(startTime.getTime() + totalMinutes * 60000);

  if (endTime.getHours() >= 2 && endTime.getHours() < 19) {
    return "Your tour will extend past 2:00 AM. Consider reducing the number of museums.";
  }

  const formattedStartTime = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedEndTime = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return `Estimated tour time: ${formatTime(totalMinutes)}
Start: ${formattedStartTime}
End: ${formattedEndTime}`;
}

export default function EnhancedMuseumRouteResponsive({ initialMuseums }: { initialMuseums: Museum[] }) {
  const [museums, setMuseums] = useState<Museum[]>([])
  const [selectedMuseums, setSelectedMuseums] = useState<Museum[]>([])
  const [optimalPath, setOptimalPath] = useState<Museum[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [googleMapsLink, setGoogleMapsLink] = useState("")
  const [timeEstimate, setTimeEstimate] = useState("")
  const [excludedMuseums, setExcludedMuseums] = useState<string[]>([])

  useEffect(() => {
    const damSquare: Museum = {
      id: 0,
      name: "Dam Square",
      address: "Dam, 1012 NP Amsterdam",
      coords: { lat: 52.373055, lng: 4.892222 },

      uri: "",
      image: { url: "", caption: "" },
      large_image: { url: "", caption: "" },
      about: "Starting point of the tour",
      notes: "",
      capacity: "open",
      capacity_title: "Open"
    }

    const validMuseums = initialMuseums.filter(museum => museum.coords && museum.coords.lat && museum.coords.lng)
    const excludedNames = initialMuseums
      .filter(museum => !museum.coords || !museum.coords.lat || !museum.coords.lng)
      .map(museum => museum.name)
    setExcludedMuseums(excludedNames)

    const museumsWithDistances = validMuseums
      .map(museum => ({
        ...museum,
        distance: calculateDistance(
          damSquare.coords.lat,
          damSquare.coords.lng,
          museum.coords.lat,
          museum.coords.lng
        )
      }))
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))

    setMuseums([damSquare, ...museumsWithDistances])
    setSelectedMuseums([damSquare])
  }, [initialMuseums])

  const handleMuseumSelect = useCallback((museumId: string) => {
    const selectedMuseum = museums.find(m => m.id === parseInt(museumId))
    if (selectedMuseum && !selectedMuseums.some(m => m.id === selectedMuseum.id)) {
      setSelectedMuseums(prev => {
        if (prev.length === 1 && prev[0].id === 0) {
          return [prev[0], selectedMuseum]
        }
        return [...prev, selectedMuseum]
      })
    }
  }, [museums, selectedMuseums])

  const handleRemoveMuseum = useCallback((museumId: number) => {
    setSelectedMuseums(prev => prev.filter(m => m.id !== museumId))
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedMuseums([museums[0]])
    setOptimalPath([])
    setGoogleMapsLink("")
    setTimeEstimate("")
    setIsAnimating(false)
  }, [museums])

  const handleStartWalkingTour = useCallback(async () => {
    setIsCalculating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const path = bruteForceOptimalPath(selectedMuseums[0], selectedMuseums.slice(1));
      setOptimalPath(path);

      setSelectedMuseums(path);
      setGoogleMapsLink(generateGoogleMapsLink(path));
      setTimeEstimate(generateTimeEstimate(path));
      setIsAnimating(true);

      // Simulate the walking tour
      await new Promise(resolve => setTimeout(resolve, path.length * 2000)); // 2 seconds per museum

      // Reset the walking tour state
      setIsAnimating(false);
    } catch (error) {
      console.error("Error calculating optimal path:", error);
    } finally {
      setIsCalculating(false);
    }
  }, [selectedMuseums]);

  const visibleMuseums = selectedMuseums.slice(0, 3)
  const hiddenMuseumsCount = selectedMuseums.length - visibleMuseums.length

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      <div className="w-full h-[50vh] md:h-full overflow-y-auto md:w-1/3 lg:w-1/4 order-2 md:order-1">
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-4 rounded-t-xl shadow-lg h-full overflow-y-auto">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>Amsterdam Museum Route Planner</CardTitle>
              <CardDescription>Plan your efficient night at the museums from 19:00 to 02:00</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              {excludedMuseums.length > 0 && (
                <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded-md text-sm">
                  Note: {excludedMuseums.length} museum(s) were excluded due to missing location data.
                </div>
              )}
              <div className="space-y-4 flex-grow flex flex-col">
                <div className="space-y-2">
                  <Select onValueChange={handleMuseumSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add a museum" />
                    </SelectTrigger>
                    <SelectContent>
                      {museums.slice(1).map((museum) => (
                        <SelectItem key={museum.id} value={museum.id.toString()} disabled={selectedMuseums.some(m => m.id === museum.id)}>
                          {museum.name} ({museum.distance?.toFixed(2)} km)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="flex-grow">
                  <div className="space-y-2">
                    {visibleMuseums.map((museum, index) => (
                      <div key={museum.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <span className="text-sm">
                          {index === 0 ? "Start: " : index === visibleMuseums.length - 1 && hiddenMuseumsCount === 0 ? "End: " : `${index + 1}. `}
                          {museum.name}
                          {index === 0 && museum.name === "Dam Square" && " 🏛️"}
                        </span>
                        {museum.distance !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {museum.distance.toFixed(2)} km • 🚶 {formatTime(calculateWalkingTime(museum.distance))}
                          </span>
                        )}
                        {index !== 0 && (
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveMuseum(museum.id)}>
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    {hiddenMuseumsCount > 0 && (
                      <div className="p-2 bg-muted rounded-md text-sm text-muted-foreground">
                        (and {hiddenMuseumsCount} more {hiddenMuseumsCount === 1 ? 'museum' : 'museums'}...)
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {timeEstimate && (
                  <div className="bg-muted p-3 rounded-md mt-4">
                    <h3 className="text-sm font-semibold flex items-center mb-2">
                      <Clock className="w-4 h-4 mr-2" />
                      Time Estimate (Optimal Route)
                    </h3>
                    <p className="text-sm whitespace-pre-line">{timeEstimate}</p>
                  </div>
                )}

                <div className="space-y-2 mt-4">
                  <Button onClick={handleStartWalkingTour} className="w-full" disabled={isCalculating || selectedMuseums.length < 2}>
                    {isCalculating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Calculating Optimal Route...
                      </>
                    ) : isAnimating ? (
                      "Walking Tour in Progress"
                    ) : (
                      "Start Walking Tour"
                    )}
                  </Button>
                  {googleMapsLink && (
                    <Button asChild variant="outline" className="w-full">
                      <a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
                        <MapPin className="mr-2 h-4 w-4" />
                        Open in Google Maps
                      </a>
                    </Button>
                  )}
                  {selectedMuseums.length > 1 && (
                    <Button onClick={handleClearSelection} variant="secondary" className="w-full">
                      Clear Selection
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="w-full h-[50vh] md:h-full flex-grow md:w-2/3 lg:w-3/4 order-1 md:order-2">
        <div className="h-full w-full">
          <Card className="h-full">
            <CardContent className="p-0 h-full">
              <MapComponent
                museums={museums}
                selectedMuseums={selectedMuseums}
                isAnimating={isAnimating}
                optimalPath={optimalPath}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
