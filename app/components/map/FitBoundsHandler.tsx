'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

interface FitBoundsHandlerProps {
  bounds: [[number, number], [number, number]]
  names: string[]
}

export function FitBoundsHandler({ bounds, names }: FitBoundsHandlerProps) {
  const map = useMap()
  const lastNamesRef = useRef<string[]>([])
  
  useEffect(() => {
    const namesStr = names.join(',')
    if (namesStr !== lastNamesRef.current.join(',')) {
      if (bounds && bounds[0] && bounds[1]) {
        map.fitBounds(bounds, { padding: [30, 30] })
      }
      lastNamesRef.current = names
    }
  }, [bounds, names, map])
  
  return null
}
