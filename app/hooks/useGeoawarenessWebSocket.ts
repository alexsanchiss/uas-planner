/**
 * useGeoawarenessWebSocket Hook - WebSocket connection for geoawareness data
 * 
 * TASK-046: Hook for WebSocket connection to the geoawareness service
 * TASK-047: Implements exponential backoff reconnection strategy
 * TASK-086: Implements fallback to legacy geozones when WebSocket fails
 * 
 * Features:
 * - Connects to ws://${NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP}/ws/gas/${uspaceId}
 * - Status tracking: connecting, connected, disconnected, error
 * - Auto-reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s)
 * - Maximum retry limit (default: 5)
 * - Fallback to HTTP API when WebSocket fails after max retries
 * - Clean unmount handling
 * - Message parsing with type safety
 */

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * WebSocket connection status
 */
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// ============================================================================
// BLOCK 1: Control Fields
// ============================================================================

// uspace_identifier: string - U-space identifier
// timestamp: string - Message timestamp

// ============================================================================
// BLOCK 2 & 3: Common Structures (shared by U-space data and Geozones)
// ============================================================================

/**
 * Vertical reference for airspace limits
 */
export interface VerticalReference {
  upper?: number
  upperReference?: string
  lower?: number
  lowerReference?: string
  uom?: string // Unit of measure (e.g., "M" for meters, "FT" for feet)
}

/**
 * Geometry types for geozones and U-space
 * Extended with verticalReference, sub_type, and radius for the new format
 */
export interface GeozoneGeometry {
  type: 'Polygon' | 'MultiPolygon' | 'Point' | 'Circle' | string
  coordinates: number[][][] | number[][][][] | number[] | string
  verticalReference?: VerticalReference
  sub_type?: string // Alternative snake_case version
  subType?: string  // CamelCase version used in geozones
  radius?: number
}

/**
 * Restriction conditions for a geozone
 * Defines what UAS operations are allowed/restricted
 */
export interface RestrictionConditions {
  uasClass?: string[]
  authorized?: string
  uasCategory?: string[]
  uasOperationMode?: string[]
  maxNoise?: number
  specialOperation?: string
  photograph?: string
}

/**
 * Zone authority contact and service information
 */
export interface ZoneAuthority {
  name?: string
  service?: string
  SiteURL?: string
  email?: string
  phone?: string
  purpose?: string
  intervalBefore?: string
  contactName?: string
}

/**
 * Schedule for limited applicability
 */
export interface ApplicabilitySchedule {
  day?: string[]
  startTime?: string
  startEvent?: string
  endTime?: string
  endEvent?: string
}

/**
 * Limited applicability (temporal restrictions)
 */
export interface LimitedApplicability {
  startDatetime?: string  // ISO format
  endDatetime?: string    // ISO format
  schedule?: ApplicabilitySchedule
}

/**
 * Geozone properties (new format)
 * Full property set for geozone features
 */
export interface GeozoneProperties {
  identifier?: string
  country?: string
  type?: 'prohibited' | 'restricted' | 'controlled' | 'advisory' | 'warning' | 'temporary' | string
  variant?: string
  region?: string
  reasons?: string
  otherReasonInfo?: string
  regulatoryException?: string
  message?: string
  extendedProperties?: string
  restrictionConditions?: RestrictionConditions
  zoneAuthority?: ZoneAuthority
  limitedApplicability?: LimitedApplicability
  // Legacy compatibility fields
  name?: string
  description?: string
  [key: string]: unknown
}

/**
 * Single geozone feature (GeoJSON Feature)
 */
export interface GeozoneFeature {
  type: 'Feature'
  id?: string | number
  bbox?: number[]
  name?: string
  source?: string
  status?: string
  geometry: GeozoneGeometry
  properties: GeozoneProperties
}

/**
 * Single geozone data structure (legacy compatibility)
 * @deprecated Use GeozoneFeature instead for new format
 */
export interface GeozoneData {
  uas_geozones_identifier?: string
  geometry: GeozoneGeometry
  properties: GeozoneProperties
  restrictions?: GeozoneRestrictions
  temporal_limits?: GeozoneTemporalLimits
  // New format fields (when using feature directly)
  type?: 'Feature'
  id?: string | number
  bbox?: number[]
  name?: string
  source?: string
  status?: string
}

/**
 * Geozone restrictions (legacy format)
 * @deprecated Use RestrictionConditions instead
 */
export interface GeozoneRestrictions {
  minAltitude?: number
  maxAltitude?: number
  uomDimensions?: string
  [key: string]: unknown
}

/**
 * Geozone temporal limits (legacy format)
 * @deprecated Use LimitedApplicability instead
 */
export interface GeozoneTemporalLimits {
  startDateTime?: string
  endDateTime?: string
  permanentStatus?: boolean
  [key: string]: unknown
}

/**
 * FeatureCollection for geozones (new format BLOCK 3)
 */
export interface GeozonesFeatureCollection {
  type: 'FeatureCollection'
  features: GeozoneFeature[]
}

// ============================================================================
// BLOCK 2: U-space Data
// ============================================================================

/**
 * U-space data structure (new format)
 * Complete U-space information as a GeoJSON Feature
 */
export interface UspaceData {
  type?: 'Feature'
  id?: number | string
  bbox?: number[]
  name?: string
  source?: string
  geometry?: GeozoneGeometry
  properties?: GeozoneProperties
  // Legacy compatibility fields
  identifier?: string
  boundary?: Array<{ latitude: number; longitude: number }>
  [key: string]: unknown
}

// ============================================================================
// Additional Data Types (NOTAMs, Manned Aircraft, etc.)
// ============================================================================

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

// ============================================================================
// Complete WebSocket Message Structure (combines all 3 blocks)
// ============================================================================

/**
 * Complete geoawareness WebSocket message data
 * 
 * New format structure:
 * - BLOCK 1: uspace_identifier, timestamp (control fields)
 * - BLOCK 2: uspace_data (U-space Feature with geometry and properties)
 * - BLOCK 3: geozones (FeatureCollection with geozone features)
 */
export interface GeoawarenessData {
  // BLOCK 1: Control fields
  uspace_identifier: string
  timestamp: string
  
  // BLOCK 2: U-space data (Feature with full geometry and properties)
  uspace_data?: UspaceData
  
  // BLOCK 3: Geozones (FeatureCollection)
  geozones?: GeozonesFeatureCollection
  
  // Legacy compatibility: array of geozone data
  geozones_data?: GeozoneData[]
  
  // Additional data types (may be added in future)
  notams_data?: NotamData[]
  manned_aircrafts_data?: MannedAircraftData[]
  metadata?: GeoawarenessMetadata
  
  // Status and error
  status?: 'success' | 'error'
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
  /** Callback when fallback data is loaded */
  onFallback?: (data: GeoawarenessData) => void
  /** Maximum number of reconnection attempts (default: 5) */
  maxRetries?: number
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseDelay?: number
  /** Maximum delay between reconnection attempts in ms (default: 16000) */
  maxDelay?: number
  /** Whether the WebSocket should be enabled (default: true) */
  enabled?: boolean
  /** Whether to fall back to HTTP API when WebSocket fails (default: true) */
  enableFallback?: boolean
  /** Custom fallback API endpoint (default: '/api/deprecated/geoawareness-geozones') */
  fallbackEndpoint?: string
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
  /** Whether currently using fallback data */
  usingFallback: boolean
  /** Whether fallback data is being fetched */
  loadingFallback: boolean
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
 * Normalize geoawareness WebSocket message to unified format
 * 
 * TASK-085: Handles both new 3-block format and legacy format
 * 
 * New format structure:
 * - Block 1: uspace_identifier, timestamp (control fields)
 * - Block 2: uspace_data (Feature with geometry and properties)
 * - Block 3: geozones (FeatureCollection with features array)
 * 
 * This function normalizes the data so that `geozones_data` is always populated
 * from either `geozones.features` (new format) or directly from `geozones_data` (legacy).
 * 
 * @param rawData - Raw data from WebSocket message
 * @returns Normalized GeoawarenessData with geozones_data populated
 */
function normalizeGeoawarenessMessage(rawData: unknown): GeoawarenessData {
  // Type guard for raw data
  const data = rawData as Record<string, unknown>
  
  // Initialize normalized data with control fields
  const normalized: GeoawarenessData = {
    uspace_identifier: (data.uspace_identifier as string) || 'unknown',
    timestamp: (data.timestamp as string) || new Date().toISOString(),
  }
  
  // Handle Block 2: U-space data
  if (data.uspace_data && typeof data.uspace_data === 'object') {
    normalized.uspace_data = data.uspace_data as UspaceData
  }
  
  // Handle Block 3: Geozones (new format with FeatureCollection)
  if (data.geozones && typeof data.geozones === 'object') {
    const geozonesObj = data.geozones as Record<string, unknown>
    
    // Check if it's a FeatureCollection
    if (geozonesObj.type === 'FeatureCollection' && Array.isArray(geozonesObj.features)) {
      // New format: geozones is a FeatureCollection
      normalized.geozones = geozonesObj as unknown as GeozonesFeatureCollection
      
      // Normalize to geozones_data for backward compatibility with existing components
      normalized.geozones_data = (geozonesObj.features as GeozoneFeature[]).map(feature => ({
        // Map Feature to GeozoneData for legacy compatibility
        uas_geozones_identifier: feature.properties?.identifier || feature.id?.toString(),
        geometry: feature.geometry,
        properties: feature.properties,
        type: feature.type,
        id: feature.id,
        bbox: feature.bbox,
        name: feature.name,
        source: feature.source,
        status: feature.status,
        // Map nested restriction/temporal data if present in properties
        restrictions: feature.properties?.restrictionConditions ? {
          minAltitude: feature.geometry?.verticalReference?.lower,
          maxAltitude: feature.geometry?.verticalReference?.upper,
          uomDimensions: feature.geometry?.verticalReference?.uom,
        } : undefined,
        temporal_limits: feature.properties?.limitedApplicability ? {
          startDateTime: feature.properties.limitedApplicability.startDatetime,
          endDateTime: feature.properties.limitedApplicability.endDatetime,
          permanentStatus: !feature.properties.limitedApplicability.startDatetime && 
                          !feature.properties.limitedApplicability.endDatetime,
        } : undefined,
      }))
    } else if (Array.isArray(geozonesObj)) {
      // Alternative: geozones is directly an array (fallback)
      normalized.geozones_data = geozonesObj as GeozoneData[]
    }
  }
  
  // Handle legacy format: direct geozones_data array
  if (!normalized.geozones_data && Array.isArray(data.geozones_data)) {
    normalized.geozones_data = data.geozones_data as GeozoneData[]
  }
  
  // Ensure geozones_data is at least an empty array
  if (!normalized.geozones_data) {
    normalized.geozones_data = []
  }
  
  // Copy over other optional fields from the message
  if (Array.isArray(data.notams_data)) {
    normalized.notams_data = data.notams_data as NotamData[]
  }
  if (Array.isArray(data.manned_aircrafts_data)) {
    normalized.manned_aircrafts_data = data.manned_aircrafts_data as MannedAircraftData[]
  }
  if (data.metadata && typeof data.metadata === 'object') {
    normalized.metadata = data.metadata as GeoawarenessMetadata
  }
  if (typeof data.status === 'string') {
    normalized.status = data.status as 'success' | 'error'
  }
  if (typeof data.error === 'string') {
    normalized.error = data.error
  }
  
  return normalized
}

/**
 * Hook for WebSocket connection to geoawareness service
 * 
 * @param options - Configuration options for the WebSocket connection
 * @returns WebSocket state and control functions
 * 
 * @example
 * ```tsx
 * const { status, data, error, reconnect, usingFallback } = useGeoawarenessWebSocket({
 *   uspaceId: 'USP-ESP-BEN-01',
 *   onMessage: (data) => console.log('Received:', data.geozones_data.length, 'geozones'),
 *   onError: (error) => console.error('WebSocket error:', error),
 *   enableFallback: true,  // Fall back to HTTP API when WS fails
 * })
 * 
 * if (status === 'connecting') return <LoadingSpinner />
 * if (status === 'error' && !usingFallback) return <ErrorMessage retry={reconnect} />
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
  onFallback,
  maxRetries = 5,
  baseDelay = 1000,
  maxDelay = 16000,
  enabled = true,
  enableFallback = true,
  fallbackEndpoint = '/api/deprecated/geoawareness-geozones',
}: UseGeoawarenessWebSocketOptions): UseGeoawarenessWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const [data, setData] = useState<GeoawarenessData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [lastMessageTime, setLastMessageTime] = useState<number | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  const [loadingFallback, setLoadingFallback] = useState(false)

  // Refs for cleanup and reconnection management
  const wsRef = useRef<WebSocket | null>(null)
  const mountedRef = useRef(true)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const manualDisconnectRef = useRef(false)
  const fallbackLoadedRef = useRef(false)
  // Use ref for retryCount inside callbacks to avoid dependency loops
  const retryCountRef = useRef(0)

  // Stable callback refs
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  const onConnectRef = useRef(onConnect)
  const onCloseRef = useRef(onClose)
  const onFallbackRef = useRef(onFallback)

  // Update callback refs
  useEffect(() => {
    onMessageRef.current = onMessage
    onErrorRef.current = onError
    onConnectRef.current = onConnect
    onCloseRef.current = onClose
    onFallbackRef.current = onFallback
  }, [onMessage, onError, onConnect, onClose, onFallback])

  /**
   * Fetch fallback geozones from HTTP API
   * TASK-086: Load legacy geozones when WebSocket fails
   */
  const fetchFallbackData = useCallback(async () => {
    if (!uspaceId || fallbackLoadedRef.current || !enableFallback) {
      return
    }

    console.log('[useGeoawarenessWebSocket] 🔄 WebSocket failed, loading fallback geozones from HTTP API...')
    setLoadingFallback(true)

    try {
      const response = await fetch(`${fallbackEndpoint}?uspaceId=${encodeURIComponent(uspaceId)}`)
      
      if (!response.ok) {
        throw new Error(`Fallback API returned ${response.status}`)
      }

      const result = await response.json()
      
      if (!mountedRef.current) return

      // Convert fallback response to GeoawarenessData format
      const fallbackData: GeoawarenessData = {
        uspace_identifier: uspaceId,
        timestamp: new Date().toISOString(),
        geozones_data: result.geozones || [],
        status: 'success',
        metadata: {
          source: 'fallback',
          lastUpdate: new Date().toISOString(),
        }
      }

      console.log(`[useGeoawarenessWebSocket] ✅ Fallback loaded successfully: ${fallbackData.geozones_data?.length || 0} geozones`)
      console.log(`[useGeoawarenessWebSocket] 📋 Fallback source: ${result.fallback ? 'static data' : 'service'}`)

      setData(fallbackData)
      setUsingFallback(true)
      setLoadingFallback(false)
      setLastMessageTime(Date.now())
      fallbackLoadedRef.current = true

      onFallbackRef.current?.(fallbackData)

    } catch (fetchError) {
      console.error('[useGeoawarenessWebSocket] ❌ Failed to load fallback geozones:', fetchError)
      
      if (!mountedRef.current) return

      setLoadingFallback(false)
      // Don't update error - keep the original WebSocket error
    }
  }, [uspaceId, enableFallback, fallbackEndpoint])

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
      console.error('[WS] Geoawareness service not configured (NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP missing)')
      const envError = new Error('Geoawareness service not configured. Please set NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP environment variable')
      setError(envError)
      setStatus('error')
      onErrorRef.current?.(envError)
      
      // TASK-086: Only trigger fallback if enabled - but log warning about deprecated usage
      if (enableFallback && !fallbackLoadedRef.current) {
        console.warn('[WS] Using deprecated HTTP fallback due to missing WebSocket configuration')
        fetchFallbackData()
      } else {
        console.log('[WS] Fallback disabled - no geoawareness data will be loaded')
      }
      return
    }

    manualDisconnectRef.current = false
    setStatus('connecting')
    setError(null)

    console.log(`[WS] Connecting to: ${wsUrl}`)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return

        console.log(`[WS] Connected to ${uspaceId}`)
        setStatus('connected')
        // Reset retry count on successful connection
        retryCountRef.current = 0
        setRetryCount(0)
        setError(null)
        // Reset fallback state on successful WebSocket connection
        setUsingFallback(false)
        fallbackLoadedRef.current = false
        onConnectRef.current?.()
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return

        try {
          const rawData = JSON.parse(event.data)
          
          // Normalize the data to support both new 3-block format and legacy format
          const normalizedData = normalizeGeoawarenessMessage(rawData)
          
          console.log(`[WS] Received ${normalizedData.geozones_data?.length || 0} geozones for ${normalizedData.uspace_identifier}`)
          
          setData(normalizedData)
          setLastMessageTime(Date.now())
          setError(null)
          onMessageRef.current?.(normalizedData)
        } catch (parseError) {
          const err = new Error(`Failed to parse WebSocket message: ${parseError}`)
          console.error('[WS] Parse error:', parseError)
          setError(err)
          onErrorRef.current?.(err)
        }
      }

      ws.onerror = (event) => {
        if (!mountedRef.current) return

        console.error('[WS] Connection error')
        const err = new Error('WebSocket connection error')
        setError(err)
        setStatus('error')
        onErrorRef.current?.(event)
      }

      ws.onclose = (event) => {
        if (!mountedRef.current) return

        console.log(`[WS] Closed (code: ${event.code})`)
        wsRef.current = null
        setStatus('disconnected')
        onCloseRef.current?.()

        // Auto-reconnect with exponential backoff if not manually disconnected
        const currentRetryCount = retryCountRef.current
        if (!manualDisconnectRef.current && enabled && currentRetryCount < maxRetries) {
          const delay = calculateBackoffDelay(currentRetryCount, baseDelay, maxDelay)
          console.log(`[WS] Reconnecting in ${delay}ms (${currentRetryCount + 1}/${maxRetries})`)
          
          retryCountRef.current = currentRetryCount + 1
          setRetryCount(currentRetryCount + 1)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect()
            }
          }, delay)
        } else if (currentRetryCount >= maxRetries) {
          console.error(`[WS] Max retries reached. Service: ${process.env.NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP}`)
          const maxRetryError = new Error(`Connection failed after ${maxRetries} attempts`)
          setError(maxRetryError)
          setStatus('error')
          
          // TASK-086: Trigger fallback to HTTP API when WebSocket fails
          if (enableFallback && !fallbackLoadedRef.current) {
            console.log('[WS] Loading fallback geozones...')
            fetchFallbackData()
          }
        }
      }
    } catch (err) {
      const connectionError = err instanceof Error ? err : new Error('Failed to create WebSocket')
      console.error('[WS] Connection error:', connectionError)
      setError(connectionError)
      setStatus('error')
      onErrorRef.current?.(connectionError)
    }
  // Remove retryCount from dependencies to prevent infinite loops
  // Use retryCountRef inside the callback instead
  }, [uspaceId, enabled, maxRetries, baseDelay, maxDelay, enableFallback, fetchFallbackData])

  /**
   * Manually trigger a reconnection attempt
   */
  const reconnect = useCallback(() => {
    console.log('[WS] Manual reconnect')
    // Reset retry count for manual reconnect
    retryCountRef.current = 0
    setRetryCount(0)
    manualDisconnectRef.current = false
    // Reset fallback state to allow fresh fallback attempt if needed
    fallbackLoadedRef.current = false
    setUsingFallback(false)
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

  // Reset fallback state when uspaceId changes
  useEffect(() => {
    fallbackLoadedRef.current = false
    setUsingFallback(false)
  }, [uspaceId])

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
    usingFallback,
    loadingFallback,
  }
}

export default useGeoawarenessWebSocket
