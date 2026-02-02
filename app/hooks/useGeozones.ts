/**
 * useGeozones Hook - Geozone data fetching via HTTP API
 * 
 * Fetches geozone data for a selected U-space using a regular HTTP API call
 * instead of WebSocket. Falls back to hardcoded test data when the service
 * is unavailable.
 * 
 * Features:
 * - Fetches geozones from /api/geoawareness/geozones endpoint
 * - Automatic fallback to hardcoded Valencia geozones on error
 * - Loading and error state tracking
 * - Refetch capability
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

/**
 * Geozone geometry structure
 */
export interface GeozoneGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

/**
 * Geozone properties
 */
export interface GeozoneProperties {
  name?: string;
  type?: 'warning' | 'prohibited' | 'restricted' | 'controlled' | 'advisory' | 'temporary' | 'CONDITIONAL' | 'PROHIBITED';
  description?: string;
  region?: string;
  country?: string;
  identifier?: string;
  zoneAuthority?: {
    name?: string;
    email?: string;
    phone?: string;
    purpose?: string;
    service?: string;
    siteURL?: string;
  };
  restrictionConditions?: {
    maxNoise?: number;
    authorized?: string;
    photograph?: string;
    uasCategory?: string | string[];
    uasOperationMode?: string | string[];
  };
  limitedApplicability?: {
    startDateTime?: string;
    endDateTime?: string;
  };
  [key: string]: unknown;
}

/**
 * Geozone restrictions
 */
export interface GeozoneRestrictions {
  minAltitude?: number;
  maxAltitude?: number;
  uomDimensions?: string;
  [key: string]: unknown;
}

/**
 * Geozone temporal limits
 */
export interface GeozoneTemporalLimits {
  startDateTime?: string;
  endDateTime?: string;
  permanentStatus?: boolean;
  [key: string]: unknown;
}

/**
 * Geozone data structure (compatible with WebSocket format)
 */
export interface GeozoneData {
  uas_geozones_identifier: string;
  geometry: GeozoneGeometry;
  properties: GeozoneProperties;
  restrictions?: GeozoneRestrictions;
  temporal_limits?: GeozoneTemporalLimits;
}

/**
 * Fallback geozones for Valencia area (WGS84 coordinates)
 * These are shown when the geoawareness service is unavailable
 */
const FALLBACK_GEOZONES: GeozoneData[] = [
  {
    uas_geozones_identifier: 'ESVC-1',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-0.3584, 39.4742],
        [-0.3607, 39.4746],
        [-0.3596, 39.4771],
        [-0.3576, 39.4765],
        [-0.3584, 39.4742],
      ]],
    },
    properties: {
      name: 'Mestalla geozone/Geozona Mestalla',
      type: 'CONDITIONAL',
      region: 'Valencian-Community',
      country: 'ESP',
      identifier: 'ESVC-1',
      zoneAuthority: {
        name: 'Policía Local de València',
        phone: '+34 962085092',
        purpose: 'AUTHORIZATION',
      },
      restrictionConditions: {
        authorized: 'REQUIRES_AUTHORIZATION',
        photograph: 'PROHIBITED',
      },
    },
  },
  {
    uas_geozones_identifier: 'ESVC-2',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-0.3179, 39.4199],
        [-0.3125, 39.4232],
        [-0.3091, 39.4297],
        [-0.3027, 39.4333],
        [-0.2915, 39.4435],
        [-0.2860, 39.4546],
        [-0.3088, 39.4627],
        [-0.3200, 39.4628],
        [-0.3299, 39.4616],
        [-0.3330, 39.4603],
        [-0.3303, 39.4555],
        [-0.3282, 39.4546],
        [-0.3287, 39.4510],
        [-0.3263, 39.4496],
        [-0.3258, 39.4441],
        [-0.3275, 39.4422],
        [-0.3313, 39.4418],
        [-0.3341, 39.4386],
        [-0.3384, 39.4384],
        [-0.3418, 39.4289],
        [-0.3179, 39.4199],
      ]],
    },
    properties: {
      name: 'Geozona Puerto València/Valencia Port geozone',
      type: 'CONDITIONAL',
      region: 'Valencian-Community',
      country: 'ESP',
      identifier: 'ESVC-2',
      zoneAuthority: {
        name: 'Autoridad Portuaria de València',
        phone: '+34 963939555',
        purpose: 'AUTHORIZATION',
        service: 'Servicio de Atención (SAC)',
      },
      restrictionConditions: {
        authorized: 'REQUIRES_AUTHORIZATION',
        photograph: 'PROHIBITED',
      },
    },
  },
  {
    uas_geozones_identifier: 'ESVC-3',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-0.3266, 39.4601],
        [-0.3237, 39.4602],
        [-0.3285, 39.4922],
        [-0.3303, 39.4922],
        [-0.3296, 39.4904],
        [-0.3295, 39.4813],
        [-0.3291, 39.4807],
        [-0.3282, 39.4650],
        [-0.3276, 39.4646],
        [-0.3266, 39.4601],
      ]],
    },
    properties: {
      name: 'Valencia Beach geozone / Geozona Playa de Valencia',
      type: 'CONDITIONAL',
      region: 'Valencian-Community',
      country: 'ESP',
      identifier: 'ESVC-3',
      zoneAuthority: {
        name: 'Policía Local de València',
        phone: '+34 962085092',
        purpose: 'AUTHORIZATION',
      },
      restrictionConditions: {
        authorized: 'REQUIRES_AUTHORIZATION',
        photograph: 'REQUIRES_AUTHORIZATION',
      },
    },
  },
  {
    uas_geozones_identifier: 'ESVC-4',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-0.3811, 39.4682],
        [-0.3802, 39.4699],
        [-0.3755, 39.4690],
        [-0.3755, 39.4669],
        [-0.3781, 39.4674],
        [-0.3784, 39.4674],
        [-0.3811, 39.4682],
      ]],
    },
    properties: {
      name: 'Geozona BioParc Valencia / BioParc Valencia geozone',
      type: 'PROHIBITED',
      region: 'Valencian-Community',
      country: 'ESP',
      identifier: 'ESVC-4',
      zoneAuthority: {
        name: 'Generalitat Valenciana',
        phone: '+34 963866000',
        purpose: 'AUTHORIZATION',
        service: 'Conselleria de Medi Ambient',
      },
      restrictionConditions: {
        authorized: 'REQUIRES_AUTHORIZATION',
        photograph: 'PROHIBITED',
      },
    },
  },
];

/**
 * Hook options
 */
interface UseGeozonesOptions {
  /** U-space identifier to fetch geozones for */
  uspaceId: string | null;
  /** Whether to enable fetching */
  enabled?: boolean;
}

/**
 * Hook return type
 */
interface UseGeozonesReturn {
  /** Array of geozones */
  geozones: GeozoneData[];
  /** Loading state */
  loading: boolean;
  /** Error message from last fetch */
  error: string | null;
  /** Whether using fallback data */
  usingFallback: boolean;
  /** Refetch geozones */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching geozone data via HTTP API
 */
export function useGeozones({
  uspaceId,
  enabled = true,
}: UseGeozonesOptions): UseGeozonesReturn {
  const [geozones, setGeozones] = useState<GeozoneData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  
  const mountedRef = useRef(true);

  const fetchGeozones = useCallback(async () => {
    if (!enabled || !uspaceId) {
      return;
    }

    setLoading(true);
    setError(null);
    setUsingFallback(false);

    console.log(`[useGeozones] Fetching geozones for U-space: ${uspaceId}`);

    try {
      const response = await axios.get('/api/geoawareness/geozones', {
        params: { uspaceId },
        timeout: 15000,
      });

      if (!mountedRef.current) return;

      if (response.data.success && response.data.geozones) {
        console.log(`[useGeozones] ✅ Received ${response.data.geozones.length} geozones from API`);
        setGeozones(response.data.geozones);
        setUsingFallback(false);
      } else {
        throw new Error(response.data.error || 'Failed to fetch geozones');
      }
    } catch (err) {
      if (!mountedRef.current) return;

      console.error('[useGeozones] ❌ Failed to fetch geozones:', err);
      console.log('[useGeozones] 📋 Using fallback geozones for Valencia area');
      
      // Use fallback data
      setGeozones(FALLBACK_GEOZONES);
      setUsingFallback(true);
      setError(err instanceof Error ? err.message : 'Failed to fetch geozones');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [uspaceId, enabled]);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled && uspaceId) {
      fetchGeozones();
    } else {
      setGeozones([]);
      setError(null);
      setUsingFallback(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [uspaceId, enabled, fetchGeozones]);

  return {
    geozones,
    loading,
    error,
    usingFallback,
    refetch: fetchGeozones,
  };
}

export default useGeozones;
