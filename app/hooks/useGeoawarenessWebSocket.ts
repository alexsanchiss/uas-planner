/**
 * useGeoawarenessWebSocket Hook - WebSocket connection for geoawareness data
 * 
 * TASK-046: Hook for WebSocket connection to the geoawareness service
 * TASK-047: Implements exponential backoff reconnection strategy
 * 
 * Features:
 * - Connects to ws://${NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP}/ws/gas/${uspaceId}
 * - Status tracking: connecting, connected, disconnected, error
 * - Auto-reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s)
 * - Maximum retry limit (default: 5)
 * - Clean unmount handling
 * - Message parsing with type safety
 */

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * WebSocket connection status
 */
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Geometry types for geozones
 */
export interface GeozoneGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

/**
 * Geozone properties
 */
export interface GeozoneProperties {
  name?: string
  type?: 'prohibited' | 'restricted' | 'controlled' | 'advisory' | 'warning' | 'temporary'
  description?: string
  [key: string]: unknown
}

/**
 * Geozone restrictions
 */
export interface GeozoneRestrictions {
  minAltitude?: number
  maxAltitude?: number
  uomDimensions?: string
  [key: string]: unknown
}

/**
 * Geozone temporal limits
 */
export interface GeozoneTemporalLimits {
  startDateTime?: string
  endDateTime?: string
  permanentStatus?: boolean
  [key: string]: unknown
}

/**
 * Single geozone data structure
 */
export interface GeozoneData {
  uas_geozones_identifier: string
  geometry: GeozoneGeometry
  properties: GeozoneProperties
  restrictions?: GeozoneRestrictions
  temporal_limits?: GeozoneTemporalLimits
}

/**
 * U-space data structure
 */
export interface UspaceData {
  name?: string
  identifier?: string
  boundary?: Array<{ latitude: number; longitude: number }>
  [key: string]: unknown
}

/**
 * NOTAM data structure
 */
export interface NotamData {
  id: string
  message: string
  effectiveStart?: string
  effectiveEnd?: string
  [key: string]: unknown
}

/**
 * Manned aircraft data structure
 */
export interface MannedAircraftData {
  id: string
  callsign?: string
  position?: { lat: number; lon: number; altitude: number }
  heading?: number
  speed?: number
  [key: string]: unknown
}

/**
 * Metadata structure
 */
export interface GeoawarenessMetadata {
  lastUpdate?: string
  source?: string
  version?: string
  [key: string]: unknown
}

/**
 * Complete geoawareness WebSocket message data
 */
export interface GeoawarenessData {
  status: 'success' | 'error'
  timestamp: string
  uspace_identifier: string
  uspace_data?: UspaceData
  geozones_data: GeozoneData[]
  notams_data?: NotamData[]
  manned_aircrafts_data?: MannedAircraftData[]
  metadata?: GeoawarenessMetadata
  error?: string
}

/**
 * Hook options
 */
export interface UseGeoawarenessWebSocketOptions {
  /** U-space identifier for the WebSocket connection */
  uspaceId: string | null
  /** Callback when a message is received */
  onMessage?: (data: GeoawarenessData) => void
  /** Callback when an error occurs */
  onError?: (error: Event | Error) => void
  /** Callback when connection is established */
  onConnect?: () => void
  /** Callback when connection is closed */
  onClose?: () => void
  /** Maximum number of reconnection attempts (default: 5) */
  maxRetries?: number
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseDelay?: number
  /** Maximum delay between reconnection attempts in ms (default: 16000) */
  maxDelay?: number
  /** Whether the WebSocket should be enabled (default: true) */
  enabled?: boolean
}

/**
 * Hook return type
 */
export interface UseGeoawarenessWebSocketReturn {
  /** Current connection status */
  status: WebSocketStatus
  /** Latest geoawareness data received */
  data: GeoawarenessData | null
  /** Error from the last connection attempt or message parsing */
  error: Error | null
  /** Number of consecutive connection errors */
  retryCount: number
  /** Manually trigger a reconnection */
  reconnect: () => void
  /** Disconnect the WebSocket */
  disconnect: () => void
  /** Whether the WebSocket is currently connected */
  isConnected: boolean
  /** Time since last successful message (ms) */
  lastMessageTime: number | null
}

/**
 * Get the WebSocket URL for a given U-space
 */
function getWebSocketUrl(uspaceId: string): string | null {
  const serviceIp = process.env.NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP
  
  if (!serviceIp) {
    console.warn('[useGeoawarenessWebSocket] NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP not configured')
    return null
  }
  
  // Add ws:// prefix if not present, handle both http and https cases
  let wsUrl = serviceIp
  if (wsUrl.startsWith('http://')) {
    wsUrl = wsUrl.replace('http://', 'ws://')
  } else if (wsUrl.startsWith('https://')) {
    wsUrl = wsUrl.replace('https://', 'wss://')
  } else if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
    wsUrl = `ws://${wsUrl}`
  }
  
  return `${wsUrl}/ws/gas/${uspaceId}`
}

/**
 * Calculate delay with exponential backoff
 * 
 * @param retryCount - Current retry attempt (0-indexed)
 * @param baseDelay - Base delay in ms
 * @param maxDelay - Maximum delay in ms
 * @returns Calculated delay in ms
 */
function calculateBackoffDelay(retryCount: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff: baseDelay * 2^retryCount
  const delay = baseDelay * Math.pow(2, retryCount)
  // Cap at maxDelay
  return Math.min(delay, maxDelay)
}

/**
 * Hook for WebSocket connection to geoawareness service
 * 
 * @param options - Configuration options for the WebSocket connection
 * @returns WebSocket state and control functions
 * 
 * @example
 * ```tsx
 * const { status, data, error, reconnect } = useGeoawarenessWebSocket({
 *   uspaceId: 'USP-ESP-BEN-01',
 *   onMessage: (data) => console.log('Received:', data.geozones_data.length, 'geozones'),
 *   onError: (error) => console.error('WebSocket error:', error),
 * })
 * 
 * if (status === 'connecting') return <LoadingSpinner />
 * if (status === 'error') return <ErrorMessage retry={reconnect} />
 * 
 * return <GeozoneViewer geozones={data?.geozones_data} />
 * ```
 */
export function useGeoawarenessWebSocket({
  uspaceId,
  onMessage,
  onError,
  onConnect,
  onClose,
  maxRetries = 5,
  baseDelay = 1000,
  maxDelay = 16000,
  enabled = true,
}: UseGeoawarenessWebSocketOptions): UseGeoawarenessWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const [data, setData] = useState<GeoawarenessData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [lastMessageTime, setLastMessageTime] = useState<number | null>(null)

  // Refs for cleanup and reconnection management
  const wsRef = useRef<WebSocket | null>(null)
  const mountedRef = useRef(true)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const manualDisconnectRef = useRef(false)

  // Stable callback refs
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  const onConnectRef = useRef(onConnect)
  const onCloseRef = useRef(onClose)

  // Update callback refs
  useEffect(() => {
    onMessageRef.current = onMessage
    onErrorRef.current = onError
    onConnectRef.current = onConnect
    onCloseRef.current = onClose
  }, [onMessage, onError, onConnect, onClose])

  /**
   * Close any existing WebSocket connection
   */
  const closeConnection = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      // Prevent reconnection on manual close
      manualDisconnectRef.current = true
      wsRef.current.close(1000, 'Client disconnect')
      wsRef.current = null
    }
  }, [])

  /**
   * Connect to the WebSocket
   */
  const connect = useCallback(() => {
    // Don't connect if disabled or no uspaceId
    if (!enabled || !uspaceId) {
      return
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    const wsUrl = getWebSocketUrl(uspaceId)
    if (!wsUrl) {
      console.error('[useGeoawarenessWebSocket] ❌ Cannot connect: NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP not configured')
      console.error('[useGeoawarenessWebSocket] Add NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP to your .env file')
      const envError = new Error('NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP not configured')
      setError(envError)
      setStatus('error')
      onErrorRef.current?.(envError)
      return
    }

    manualDisconnectRef.current = false
    setStatus('connecting')
    setError(null)

    console.log(`[useGeoawarenessWebSocket] Attempting connection to: ${wsUrl}`)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return

        console.log(`[useGeoawarenessWebSocket] ✅ Connected successfully to ${uspaceId}`)
        console.log(`[useGeoawarenessWebSocket] WebSocket URL: ${wsUrl}`)
        setStatus('connected')
        setRetryCount(0) // Reset retry count on successful connection
        setError(null)
        onConnectRef.current?.()
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return

        try {
          const parsedData = JSON.parse(event.data) as GeoawarenessData
          console.log(`[useGeoawarenessWebSocket] 📨 Received message with ${parsedData.geozones_data?.length || 0} geozones`)
          setData(parsedData)
          setLastMessageTime(Date.now())
          setError(null)
          onMessageRef.current?.(parsedData)
        } catch (parseError) {
          const err = new Error(`Failed to parse WebSocket message: ${parseError}`)
          console.error('[useGeoawarenessWebSocket] ❌ Parse error:', parseError)
          console.error('[useGeoawarenessWebSocket] Raw message:', event.data)
          setError(err)
          onErrorRef.current?.(err)
        }
      }

      ws.onerror = (event) => {
        if (!mountedRef.current) return

        console.error('[useGeoawarenessWebSocket] ❌ WebSocket error occurred')
        console.error('[useGeoawarenessWebSocket] Connection URL was:', wsUrl)
        console.error('[useGeoawarenessWebSocket] Error event:', event)
        const err = new Error('WebSocket connection error')
        setError(err)
        setStatus('error')
        onErrorRef.current?.(event)
      }

      ws.onclose = (event) => {
        if (!mountedRef.current) return

        console.log(`[useGeoawarenessWebSocket] 🔌 Connection closed`)
        console.log(`[useGeoawarenessWebSocket] Close code: ${event.code}, reason: ${event.reason || '(no reason provided)'}`)
        console.log(`[useGeoawarenessWebSocket] Was clean close: ${event.wasClean}`)
        wsRef.current = null
        setStatus('disconnected')
        onCloseRef.current?.()

        // Auto-reconnect with exponential backoff if not manually disconnected
        if (!manualDisconnectRef.current && enabled && retryCount < maxRetries) {
          const delay = calculateBackoffDelay(retryCount, baseDelay, maxDelay)
          console.log(`[useGeoawarenessWebSocket] 🔄 Reconnecting in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
          console.log(`[useGeoawarenessWebSocket] Target URL: ws://${process.env.NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP}/ws/gas/${uspaceId}`)
          
          setRetryCount(prev => prev + 1)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect()
            }
          }, delay)
        } else if (retryCount >= maxRetries) {
          console.error(`[useGeoawarenessWebSocket] ❌ Max retries (${maxRetries}) reached, stopping reconnection`)
          console.error(`[useGeoawarenessWebSocket] Check if the geoawareness service is running at: ${process.env.NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP}`)
          const maxRetryError = new Error(`Connection failed after ${maxRetries} attempts`)
          setError(maxRetryError)
          setStatus('error')
        }
      }
    } catch (err) {
      const connectionError = err instanceof Error ? err : new Error('Failed to create WebSocket')
      console.error('[useGeoawarenessWebSocket] ❌ Connection error:', connectionError)
      console.error('[useGeoawarenessWebSocket] Attempted URL:', wsUrl)
      setError(connectionError)
      setStatus('error')
      onErrorRef.current?.(connectionError)
    }
  }, [uspaceId, enabled, retryCount, maxRetries, baseDelay, maxDelay])

  /**
   * Manually trigger a reconnection attempt
   */
  const reconnect = useCallback(() => {
    console.log('[useGeoawarenessWebSocket] Manual reconnect requested')
    setRetryCount(0) // Reset retry count for manual reconnect
    manualDisconnectRef.current = false
    closeConnection()
    
    // Wait a tick before reconnecting
    setTimeout(() => {
      if (mountedRef.current) {
        connect()
      }
    }, 100)
  }, [connect, closeConnection])

  /**
   * Disconnect the WebSocket
   */
  const disconnect = useCallback(() => {
    console.log('[useGeoawarenessWebSocket] Manual disconnect')
    manualDisconnectRef.current = true
    closeConnection()
    setStatus('disconnected')
  }, [closeConnection])

  // Connect when uspaceId changes or enabled state changes
  useEffect(() => {
    mountedRef.current = true

    if (enabled && uspaceId) {
      connect()
    } else {
      closeConnection()
      setStatus('disconnected')
    }

    return () => {
      mountedRef.current = false
      closeConnection()
    }
  }, [uspaceId, enabled, connect, closeConnection])

  return {
    status,
    data,
    error,
    retryCount,
    reconnect,
    disconnect,
    isConnected: status === 'connected',
    lastMessageTime,
  }
}

export default useGeoawarenessWebSocket
