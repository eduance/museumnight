import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'

export async function GET() {
  try {
    const dataDirectory = path.join(process.cwd(), 'public')
    const fileContents = await fs.readFile(dataDirectory + '/museums.json', 'utf8')
    const data = JSON.parse(fileContents)

    // Log museums with missing coordinates
    const museumsWithMissingCoords = data.filter(museum => !museum.coords || !museum.coords.lat || !museum.coords.lng);
    if (museumsWithMissingCoords.length > 0) {
      console.warn('Museums with missing coordinates:', museumsWithMissingCoords.map(m => m.name));
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error reading museums data:', error)
    return NextResponse.json({ error: 'Failed to load museums data' }, { status: 500 })
  }
}
