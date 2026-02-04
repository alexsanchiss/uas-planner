/**
 * Geozone Normalizer - TASK-087
 * 
 * Unified normalization for geozone data from both new WebSocket format
 * and legacy GeoJSON format (geozones_dataFrame.geojson).
 * 
 * This module provides functions to convert various geozone data formats
 * into a consistent structure that can be used throughout the application.
 */

// ============================================================================
// Normalized Types (Output format for all components)
// ============================================================================

/**
 * Normalized geozone geometry
 */
export interface NormalizedGeometry {
  type: 'Polygon' | 'MultiPolygon' | 'Point' | 'Circle' | string
  coordinates: number[][][] | number[][][][] | number[]
  verticalReference?: {
    upper?: number
    upperReference?: string
    lower?: number
    lowerReference?: string
    uom?: string
  }
}

/**
 * Normalized restriction conditions
 */
export interface NormalizedRestrictions {
  uasClass?: string[]
  authorized?: string
  uasCategory?: string[]
  uasOperationMode?: string[]
  maxNoise?: number
  specialOperation?: string
  photograph?: string
  minAltitude?: number
  maxAltitude?: number
  altitudeUom?: string
}

/**
 * Normalized temporal limits
 */
export interface NormalizedTemporalLimits {
  startDateTime?: string
  endDateTime?: string
  permanent?: boolean
  schedule?: {
    days?: string[]
    startTime?: string
    startEvent?: string
    endTime?: string
    endEvent?: string
  }
}

/**
 * Normalized authority information
 */
export interface NormalizedAuthority {
  name?: string
  service?: string
  website?: string
  email?: string
  phone?: string
  purpose?: string
  intervalBefore?: string
  contactName?: string
}

/**
 * Normalized geozone structure
 * This is the output format used by all components
 */
export interface NormalizedGeozone {
  id: string
  name: string
  type: string
  variant?: string
  country?: string
  region?: string
  reasons?: string[]
  message?: string
  geometry: NormalizedGeometry
  restrictions: NormalizedRestrictions
  temporalLimits: NormalizedTemporalLimits
  authority: NormalizedAuthority
}

// ============================================================================
// Input Types (Various source formats)
// ============================================================================

/**
 * Legacy geozone format (from geozones_dataFrame.geojson or API fallback)
 */
interface LegacyGeozone {
  uas_geozones_identifier?: string
  type?: string
  id?: string | number
  bbox?: number[]
  name?: string
  geometry: {
    type: string
    coordinates: unknown
  }
  properties?: {
    name?: string
    type?: string
    variant?: string
    country?: string
    region?: string
    identifier?: string
    message?: string
    reasons?: string | string[]
    otherReasonInfo?: string | string[]
    regulationExemption?: string
    zoneAuthority?: {
      name?: string
      email?: string
      phone?: string
      service?: string
      siteURL?: string
      purpose?: string
      intervalBefore?: string
      contact?: {
        contactName?: string
        contactRole?: string
      }
    }
    restrictionConditions?: {
      maxNoise?: number
      uasClass?: string[]
      authorized?: string
      photograph?: string
      uasCategory?: string | string[]
      specialoperation?: string
      specialOperation?: string  // Alternate casing
      uasOperationMode?: string | string[]
    }
    limitedApplicability?: {
      schedule?: {
        day?: string[]
        endTime?: string
        endEvent?: string
        startTime?: string
        startEvent?: string
      } | string
      endDateTime?: string
      endDatetime?: string  // Alternate casing
      startDateTime?: string
      startDatetime?: string  // Alternate casing
    }
    [key: string]: unknown
  }
  restrictions?: {
    minAltitude?: number
    maxAltitude?: number
    uomDimensions?: string
    [key: string]: unknown
  }
  temporal_limits?: {
    startDateTime?: string
    endDateTime?: string
    permanentStatus?: boolean
    [key: string]: unknown
  }
}

/**
 * New WebSocket format geozone feature
 */
interface WebSocketGeozoneFeature {
  type: 'Feature'
  id?: string | number
  bbox?: number[]
  name?: string
  source?: string
  status?: string
  geometry: {
    type: string
    coordinates: unknown
    verticalReference?: {
      upper?: number
      upperReference?: string
      lower?: number
      lowerReference?: string
      uom?: string
    }
    sub_type?: string
    subType?: string
    radius?: number
  }
  properties?: {
    identifier?: string
    name?: string
    type?: string
    variant?: string
    country?: string
    region?: string
    reasons?: string
    otherReasonInfo?: string
    regulatoryException?: string
    message?: string
    extendedProperties?: string
    restrictionConditions?: {
      uasClass?: string[]
      authorized?: string
      uasCategory?: string[]
      uasOperationMode?: string[]
      maxNoise?: number
      specialOperation?: string
      photograph?: string
    }
    zoneAuthority?: {
      name?: string
      service?: string
      SiteURL?: string
      email?: string
      phone?: string
      purpose?: string
      intervalBefore?: string
      contactName?: string
    }
    limitedApplicability?: {
      startDatetime?: string
      endDatetime?: string
      schedule?: {
        day?: string[]
        startTime?: string
        startEvent?: string
        endTime?: string
        endEvent?: string
      }
    }
    [key: string]: unknown
  }
}

// ============================================================================
// Normalizer Functions
// ============================================================================

/**
 * Normalize a legacy geozone to the unified format
 */
export function normalizeLegacyGeozone(geozone: LegacyGeozone): NormalizedGeozone {
  const props = geozone.properties || {}
  const restrictions = geozone.restrictions || {}
  const temporalLimits = geozone.temporal_limits || {}
  
  // Extract ID from various sources
  const id = geozone.uas_geozones_identifier || 
             props.identifier || 
             (typeof geozone.id === 'string' ? geozone.id : geozone.id?.toString()) ||
             `geozone-${Math.random().toString(36).substr(2, 9)}`

  // Extract name
  const name = props.name || geozone.name || id

  // Extract type
  const type = (props.type || 'unknown').toUpperCase()

  // Normalize reasons to array
  let reasons: string[] = []
  if (Array.isArray(props.reasons)) {
    reasons = props.reasons
  } else if (typeof props.reasons === 'string') {
    reasons = props.reasons.split(',').map(r => r.trim())
  }

  // Normalize restriction conditions
  const restrictionConditions = props.restrictionConditions || {}
  const normalizedRestrictions: NormalizedRestrictions = {
    uasClass: restrictionConditions.uasClass,
    authorized: restrictionConditions.authorized,
    uasCategory: Array.isArray(restrictionConditions.uasCategory) 
      ? restrictionConditions.uasCategory 
      : restrictionConditions.uasCategory 
        ? [restrictionConditions.uasCategory] 
        : undefined,
    uasOperationMode: Array.isArray(restrictionConditions.uasOperationMode)
      ? restrictionConditions.uasOperationMode
      : restrictionConditions.uasOperationMode
        ? [restrictionConditions.uasOperationMode]
        : undefined,
    maxNoise: restrictionConditions.maxNoise,
    specialOperation: restrictionConditions.specialoperation || restrictionConditions.specialOperation,
    photograph: restrictionConditions.photograph,
    minAltitude: restrictions.minAltitude,
    maxAltitude: restrictions.maxAltitude,
    altitudeUom: restrictions.uomDimensions,
  }

  // Normalize temporal limits
  const limitedApplicability = props.limitedApplicability || {}
  const normalizedTemporalLimits: NormalizedTemporalLimits = {
    startDateTime: limitedApplicability.startDateTime || 
                   limitedApplicability.startDatetime || 
                   temporalLimits.startDateTime,
    endDateTime: limitedApplicability.endDateTime || 
                 limitedApplicability.endDatetime || 
                 temporalLimits.endDateTime,
    permanent: temporalLimits.permanentStatus,
    schedule: typeof limitedApplicability.schedule === 'object' && limitedApplicability.schedule !== null
      ? {
          days: limitedApplicability.schedule.day,
          startTime: limitedApplicability.schedule.startTime,
          startEvent: limitedApplicability.schedule.startEvent,
          endTime: limitedApplicability.schedule.endTime,
          endEvent: limitedApplicability.schedule.endEvent,
        }
      : undefined,
  }

  // Normalize authority
  const zoneAuthority = props.zoneAuthority || {}
  const normalizedAuthority: NormalizedAuthority = {
    name: zoneAuthority.name,
    service: zoneAuthority.service,
    website: zoneAuthority.siteURL,
    email: zoneAuthority.email,
    phone: zoneAuthority.phone,
    purpose: zoneAuthority.purpose,
    intervalBefore: zoneAuthority.intervalBefore,
    contactName: zoneAuthority.contact?.contactName,
  }

  return {
    id,
    name,
    type,
    variant: props.variant,
    country: props.country,
    region: props.region,
    reasons,
    message: props.message || undefined,
    geometry: {
      type: geozone.geometry.type as NormalizedGeometry['type'],
      coordinates: geozone.geometry.coordinates as NormalizedGeometry['coordinates'],
    },
    restrictions: normalizedRestrictions,
    temporalLimits: normalizedTemporalLimits,
    authority: normalizedAuthority,
  }
}

/**
 * Normalize a WebSocket geozone feature to the unified format
 */
export function normalizeWebSocketGeozone(feature: WebSocketGeozoneFeature): NormalizedGeozone {
  const props = feature.properties || {}
  const geometry = feature.geometry

  // Extract ID
  const id = props.identifier || 
             (typeof feature.id === 'string' ? feature.id : feature.id?.toString()) ||
             `geozone-${Math.random().toString(36).substr(2, 9)}`

  // Extract name
  const name = props.name || feature.name || id

  // Extract type
  const type = (props.type || 'unknown').toUpperCase()

  // Parse reasons
  let reasons: string[] = []
  if (typeof props.reasons === 'string') {
    reasons = props.reasons.split(',').map(r => r.trim())
  }

  // Normalize restriction conditions
  const restrictionConditions = props.restrictionConditions || {}
  const normalizedRestrictions: NormalizedRestrictions = {
    uasClass: restrictionConditions.uasClass,
    authorized: restrictionConditions.authorized,
    uasCategory: restrictionConditions.uasCategory,
    uasOperationMode: restrictionConditions.uasOperationMode,
    maxNoise: restrictionConditions.maxNoise,
    specialOperation: restrictionConditions.specialOperation,
    photograph: restrictionConditions.photograph,
    minAltitude: geometry.verticalReference?.lower,
    maxAltitude: geometry.verticalReference?.upper,
    altitudeUom: geometry.verticalReference?.uom,
  }

  // Normalize temporal limits
  const limitedApplicability = props.limitedApplicability || {}
  const normalizedTemporalLimits: NormalizedTemporalLimits = {
    startDateTime: limitedApplicability.startDatetime,
    endDateTime: limitedApplicability.endDatetime,
    permanent: !limitedApplicability.startDatetime && !limitedApplicability.endDatetime,
    schedule: limitedApplicability.schedule
      ? {
          days: limitedApplicability.schedule.day,
          startTime: limitedApplicability.schedule.startTime,
          startEvent: limitedApplicability.schedule.startEvent,
          endTime: limitedApplicability.schedule.endTime,
          endEvent: limitedApplicability.schedule.endEvent,
        }
      : undefined,
  }

  // Normalize authority
  const zoneAuthority = props.zoneAuthority || {}
  const normalizedAuthority: NormalizedAuthority = {
    name: zoneAuthority.name,
    service: zoneAuthority.service,
    website: zoneAuthority.SiteURL,
    email: zoneAuthority.email,
    phone: zoneAuthority.phone,
    purpose: zoneAuthority.purpose,
    intervalBefore: zoneAuthority.intervalBefore,
    contactName: zoneAuthority.contactName,
  }

  return {
    id,
    name,
    type,
    variant: props.variant,
    country: props.country,
    region: props.region,
    reasons,
    message: props.message || undefined,
    geometry: {
      type: geometry.type as NormalizedGeometry['type'],
      coordinates: geometry.coordinates as NormalizedGeometry['coordinates'],
      verticalReference: geometry.verticalReference,
    },
    restrictions: normalizedRestrictions,
    temporalLimits: normalizedTemporalLimits,
    authority: normalizedAuthority,
  }
}

/**
 * Normalize a geozone from any format to the unified format
 * Automatically detects the input format and applies the correct normalizer
 */
export function normalizeGeozone(
  geozone: unknown,
  format: 'auto' | 'legacy' | 'websocket' = 'auto'
): NormalizedGeozone {
  const gz = geozone as Record<string, unknown>

  // Auto-detect format
  if (format === 'auto') {
    // WebSocket format has Feature type and specific property structure
    if (gz.type === 'Feature' && gz.properties && 
        ((gz.properties as Record<string, unknown>).restrictionConditions || 
         (gz.geometry as Record<string, unknown>)?.verticalReference)) {
      format = 'websocket'
    } else {
      format = 'legacy'
    }
  }

  if (format === 'websocket') {
    return normalizeWebSocketGeozone(geozone as unknown as WebSocketGeozoneFeature)
  } else {
    return normalizeLegacyGeozone(geozone as unknown as LegacyGeozone)
  }
}

/**
 * Normalize an array of geozones from any format
 */
export function normalizeGeozones(
  geozones: unknown[],
  format: 'auto' | 'legacy' | 'websocket' = 'auto'
): NormalizedGeozone[] {
  return geozones.map(gz => normalizeGeozone(gz, format))
}

/**
 * Normalize a GeoJSON FeatureCollection to array of NormalizedGeozone
 */
export function normalizeFeatureCollection(
  featureCollection: { type: string; features: unknown[] }
): NormalizedGeozone[] {
  if (featureCollection.type !== 'FeatureCollection' || !Array.isArray(featureCollection.features)) {
    console.warn('[geozone-normalizer] Invalid FeatureCollection format')
    return []
  }

  return featureCollection.features.map(feature => normalizeGeozone(feature, 'auto'))
}

/**
 * Convert NormalizedGeozone back to legacy format for backward compatibility
 * This is useful when components still expect the old format
 */
export function toLegacyFormat(normalized: NormalizedGeozone): LegacyGeozone {
  return {
    uas_geozones_identifier: normalized.id,
    type: 'Feature',
    geometry: {
      type: normalized.geometry.type,
      coordinates: normalized.geometry.coordinates,
    },
    properties: {
      identifier: normalized.id,
      name: normalized.name,
      type: normalized.type,
      variant: normalized.variant,
      country: normalized.country,
      region: normalized.region,
      reasons: normalized.reasons,
      message: normalized.message,
      restrictionConditions: {
        uasClass: normalized.restrictions.uasClass,
        authorized: normalized.restrictions.authorized,
        uasCategory: normalized.restrictions.uasCategory,
        uasOperationMode: normalized.restrictions.uasOperationMode,
        maxNoise: normalized.restrictions.maxNoise,
        specialOperation: normalized.restrictions.specialOperation,
        photograph: normalized.restrictions.photograph,
      },
      zoneAuthority: {
        name: normalized.authority.name,
        service: normalized.authority.service,
        siteURL: normalized.authority.website,
        email: normalized.authority.email,
        phone: normalized.authority.phone,
        purpose: normalized.authority.purpose,
        intervalBefore: normalized.authority.intervalBefore,
        contact: normalized.authority.contactName 
          ? { contactName: normalized.authority.contactName, contactRole: '' }
          : undefined,
      },
      limitedApplicability: {
        startDateTime: normalized.temporalLimits.startDateTime,
        endDateTime: normalized.temporalLimits.endDateTime,
        schedule: normalized.temporalLimits.schedule
          ? {
              day: normalized.temporalLimits.schedule.days,
              startTime: normalized.temporalLimits.schedule.startTime,
              startEvent: normalized.temporalLimits.schedule.startEvent,
              endTime: normalized.temporalLimits.schedule.endTime,
              endEvent: normalized.temporalLimits.schedule.endEvent,
            }
          : undefined,
      },
    },
    restrictions: {
      minAltitude: normalized.restrictions.minAltitude,
      maxAltitude: normalized.restrictions.maxAltitude,
      uomDimensions: normalized.restrictions.altitudeUom,
    },
    temporal_limits: {
      startDateTime: normalized.temporalLimits.startDateTime,
      endDateTime: normalized.temporalLimits.endDateTime,
      permanentStatus: normalized.temporalLimits.permanent,
    },
  }
}

export default {
  normalizeGeozone,
  normalizeGeozones,
  normalizeLegacyGeozone,
  normalizeWebSocketGeozone,
  normalizeFeatureCollection,
  toLegacyFormat,
}
