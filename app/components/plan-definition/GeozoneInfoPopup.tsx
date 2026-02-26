/**
 * GeozoneInfoPopup Component
 * TASK-050: Popup component for displaying detailed geozone information
 * TASK-070: Enhanced with expandable sections for all geozone information
 * TASK-071: Collapsible/expandable UI with chevron icons and smooth animations
 * TASK-088: Updated for new WebSocket format fields:
 *   - restrictionConditions: uasClass, authorized, uasCategory, uasOperationMode, maxNoise, specialOperation, photograph
 *   - zoneAuthority: name, service, SiteURL, email, phone, purpose, intervalBefore, contactName
 *   - limitedApplicability: startDatetime, endDatetime, schedule (day, startTime, startEvent, endTime, endEvent)
 *   - geometry.verticalReference: upper, upperReference, lower, lowerReference, uom
 *   - Handles both object properties (new) and JSON string properties (legacy)
 *
 * Features:
 * - Displays geozone identifier and name prominently
 * - Expandable sections: General Info, Altitude Limits, Restrictions, Limited Applicability, Authority, Schedule
 * - Chevron icons with rotation animation for collapse/expand
 * - Smooth height transitions for section content
 * - Respects theme settings
 * - Styled to match geozones_map.html popup design
 * - Backward compatible with legacy data formats
 */

"use client";

import React, { useMemo, useState, useCallback } from "react";
import { Popup } from "react-leaflet";
import L from "leaflet";
import { ChevronDown } from "lucide-react";
import type { GeozoneData } from "@/app/hooks/useGeoawarenessWebSocket";

/**
 * Color configuration for geozone types
 */
const GEOZONE_TYPE_COLORS: Record<string, string> = {
  prohibited: "#DC2626",
  restricted: "#F97316",
  controlled: "#EAB308",
  advisory: "#3B82F6",
  warning: "#8B5CF6",
  temporary: "#6B7280",
  PROHIBITED: "#4daf4a",
  REQ_AUTHORIZATION: "#ff7f00",
  CONDITIONAL: "#a65628",
  NO_RESTRICTION: "#999999",
  "U-SPACE": "#e41a1c",
};

/**
 * Get display name for geozone type
 */
function getTypeDisplayName(type?: string): string {
  if (!type) return "Unknown";
  
  const displayNames: Record<string, string> = {
    prohibited: "Prohibited",
    restricted: "Restricted",
    controlled: "Controlled",
    advisory: "Advisory",
    warning: "Warning",
    temporary: "Temporary",
    PROHIBITED: "Prohibited",
    REQ_AUTHORIZATION: "Requires Authorization",
    CONDITIONAL: "Conditional",
    NO_RESTRICTION: "No Restriction",
    "U-SPACE": "U-Space",
  };
  
  return displayNames[type] || type;
}

/**
 * Get color for geozone type
 */
function getTypeColor(type?: string): string {
  if (!type) return "#6B7280";
  return GEOZONE_TYPE_COLORS[type] || GEOZONE_TYPE_COLORS[type.toLowerCase()] || "#6B7280";
}

/**
 * Parse JSON string safely, or return the object directly if already parsed
 * TASK-088: Updated to handle both JSON strings (legacy) and direct objects (new format)
 */
function safeParseOrReturn<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  
  // If it's already an object, return it directly
  if (typeof value === 'object') {
    return value as T;
  }
  
  // If it's a string, try to parse it as JSON
  if (typeof value === 'string') {
    if (value === '' || value === 'null' || value === 'undefined') return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Format date string for display
 */
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr || dateStr === "null") return "N/A";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

/**
 * TASK-088: Restriction conditions interface (matches new WebSocket format)
 */
interface RestrictionConditions {
  maxNoise?: number;
  uasClass?: string[];
  authorized?: string;
  photograph?: string;
  uasCategory?: string | string[];
  specialOperation?: string; // New format uses camelCase
  specialoperation?: string; // Legacy format
  uasOperationMode?: string | string[];
}

/**
 * TASK-088: Schedule interface for limited applicability
 */
interface ApplicabilitySchedule {
  day?: string[];
  startTime?: string | null;
  startEvent?: string | null;
  endTime?: string | null;
  endEvent?: string | null;
}

/**
 * TASK-088: Limited applicability interface (matches new WebSocket format)
 */
interface LimitedApplicability {
  schedule?: ApplicabilitySchedule | string;
  startDateTime?: string;  // Legacy format
  endDateTime?: string;    // Legacy format
  startDatetime?: string;  // New format (lowercase 't')
  endDatetime?: string;    // New format (lowercase 't')
}

/**
 * TASK-088: Zone authority interface (matches new WebSocket format)
 */
interface ZoneAuthority {
  name?: string;
  email?: string;
  phone?: string;
  siteURL?: string;  // Legacy format
  SiteURL?: string;  // New format (capital S)
  purpose?: string;
  service?: string;
  intervalBefore?: string; // New field
  contactName?: string;    // New field (direct, not nested)
  contact?: {              // Legacy nested format
    contactName?: string;
    contactRole?: string;
  };
}

/**
 * TASK-088: Vertical reference interface for altitude limits
 */
interface VerticalReference {
  upper?: number;
  upperReference?: string;
  lower?: number;
  lowerReference?: string;
  uom?: string;
}

interface GeozoneInfoPopupProps {
  /** The geozone data to display */
  geozone: GeozoneData;
  /** Position for the popup (Leaflet LatLng) */
  position: L.LatLngExpression;
  /** Callback when popup is closed */
  onClose?: () => void;
}

/**
 * TASK-071: Collapsible section component with chevron icon and smooth animation
 */
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  /** Icon to show next to title (optional) */
  icon?: React.ReactNode;
}

function CollapsibleSection({ title, children, defaultExpanded = false, icon }: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);
  
  return (
    <div className="mb-2 border border-[var(--border-primary)] rounded-md overflow-hidden">
      {/* Section header - clickable */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-2 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors text-left focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:ring-inset"
      >
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-[var(--text-secondary)]">{icon}</span>}
          <span className="text-xs font-semibold text-[var(--text-primary)]">{title}</span>
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-[var(--text-secondary)] transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : 'rotate-0'
          }`}
        />
      </button>
      
      {/* Section content - animated */}
      <div 
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-2 py-2 text-xs text-[var(--text-secondary)] bg-[var(--surface-primary)]">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple (non-collapsible) section component for grouping information
 * Used in compact layouts
 */
function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-[var(--text-primary)] mb-1.5 border-b border-[var(--border-primary)] pb-1">
        {title}
      </div>
      <div className="text-xs text-[var(--text-secondary)]">
        {children}
      </div>
    </div>
  );
}

/**
 * Info row component for key-value pairs
 */
function InfoRow({ label, value, valueClassName = "" }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="flex justify-between items-start py-0.5">
      <span className="text-[var(--text-secondary)] font-medium mr-2">{label}:</span>
      <span className={`text-right flex-1 ${valueClassName}`}>{value || "N/A"}</span>
    </div>
  );
}

/**
 * Badge component for displaying status/type
 */
function TypeBadge({ type }: { type?: string }) {
  const color = getTypeColor(type);
  const displayName = getTypeDisplayName(type);
  
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {displayName}
    </span>
  );
}

/**
 * GeozoneInfoPopup - Displays detailed information about a geozone
 * 
 * @example
 * ```tsx
 * const [selectedGeozone, setSelectedGeozone] = useState<GeozoneData | null>(null);
 * const [popupPosition, setPopupPosition] = useState<L.LatLngExpression | null>(null);
 * 
 * // When geozone is clicked
 * const handleGeozoneClick = (geozone: GeozoneData, event: L.LeafletMouseEvent) => {
 *   setSelectedGeozone(geozone);
 *   setPopupPosition(event.latlng);
 * };
 * 
 * return (
 *   <MapContainer>
 *     <GeozoneLayer geozones={geozones} onGeozoneClick={handleGeozoneClick} />
 *     {selectedGeozone && popupPosition && (
 *       <GeozoneInfoPopup
 *         geozone={selectedGeozone}
 *         position={popupPosition}
 *         onClose={() => setSelectedGeozone(null)}
 *       />
 *     )}
 *   </MapContainer>
 * );
 * ```
 */
export function GeozoneInfoPopup({ geozone, position, onClose }: GeozoneInfoPopupProps) {
  // Style override for leaflet popup background to match theme
  React.useEffect(() => {
    const styleId = 'geozone-popup-theme-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .leaflet-popup-content-wrapper {
          background: var(--surface-primary, #fff) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  const { properties } = geozone;
  
  // TASK-088: Parse extended properties supporting both new WebSocket format and legacy JSON strings
  const extendedProps = useMemo(() => {
    // Check if geozone has additional properties (from real data)
    const geo = geozone as GeozoneData & {
      properties: GeozoneData["properties"] & {
        restrictionConditions?: RestrictionConditions | string;
        limitedApplicability?: LimitedApplicability | string;
        zoneAuthority?: ZoneAuthority | string;
        country?: string;
        region?: string;
        identifier?: string;
        variant?: string;
        reasons?: string;
        otherReasonInfo?: string;
        regulatoryException?: string;
        message?: string;
      };
      geometry: GeozoneData["geometry"] & {
        verticalReference?: VerticalReference;
        subType?: string;
        sub_type?: string;
        radius?: number;
      };
    };
    
    // Use safeParseOrReturn to handle both objects and JSON strings
    const restrictions = safeParseOrReturn<RestrictionConditions>(
      geo.properties?.restrictionConditions
    );
    
    const limitedApplicability = safeParseOrReturn<LimitedApplicability>(
      geo.properties?.limitedApplicability
    );
    
    const zoneAuthority = safeParseOrReturn<ZoneAuthority>(
      geo.properties?.zoneAuthority
    );
    
    // Extract verticalReference from geometry
    const verticalReference = geo.geometry?.verticalReference || null;
    
    return {
      restrictions,
      limitedApplicability,
      zoneAuthority,
      verticalReference,
      country: (geo.properties as Record<string, unknown>)?.country as string,
      region: (geo.properties as Record<string, unknown>)?.region as string,
      identifier: geo.uas_geozones_identifier || (geo.properties as Record<string, unknown>)?.identifier as string,
      variant: (geo.properties as Record<string, unknown>)?.variant as string,
      reasons: (geo.properties as Record<string, unknown>)?.reasons as string,
      otherReasonInfo: (geo.properties as Record<string, unknown>)?.otherReasonInfo as string,
      regulatoryException: (geo.properties as Record<string, unknown>)?.regulatoryException as string,
      message: (geo.properties as Record<string, unknown>)?.message as string,
      subType: geo.geometry?.subType || geo.geometry?.sub_type,
      radius: geo.geometry?.radius,
    };
  }, [geozone]);
  
  // Get display values
  const geozoneName = properties?.name || geozone.uas_geozones_identifier;
  const geozoneType = properties?.type;
  const typeColor = getTypeColor(geozoneType);
  
  return (
    <Popup
      position={position}
      eventHandlers={{
        remove: () => onClose?.(),
      }}
      maxWidth={380}
      minWidth={280}
      closeButton={true}
      className="geozone-info-popup"
    >
      <div className="min-w-[260px] max-w-[360px]">
        {/* Header with identifier and type badge */}
        <div 
          className="px-3 py-2 -mx-2 -mt-2 mb-3 rounded-t"
          style={{ backgroundColor: `${typeColor}20`, borderBottom: `2px solid ${typeColor}` }}
        >
          <div className="font-bold text-[var(--text-primary)] text-sm">
            {extendedProps.identifier || geozone.uas_geozones_identifier}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-2">
            <span className="truncate flex-1">{geozoneName}</span>
            <TypeBadge type={geozoneType} />
          </div>
        </div>
        
        {/* TASK-070 & TASK-071: Expandable sections with all geozone information */}
        <div className="space-y-1">
          {/* General Information - expanded by default */}
          <CollapsibleSection 
            title="General Information" 
            defaultExpanded={true}
            icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          >
            <InfoRow label="Name" value={geozoneName} />
            {extendedProps.country && (
              <InfoRow label="Country" value={extendedProps.country} />
            )}
            {extendedProps.region && (
              <InfoRow label="Region" value={extendedProps.region} />
            )}
            {extendedProps.variant && (
              <InfoRow label="Variant" value={extendedProps.variant} />
            )}
            {properties?.description && (
              <InfoRow label="Description" value={properties.description} />
            )}
            {extendedProps.reasons && (
              <InfoRow label="Reasons" value={extendedProps.reasons} />
            )}
            {extendedProps.otherReasonInfo && (
              <InfoRow label="Additional Info" value={extendedProps.otherReasonInfo} />
            )}
            {extendedProps.regulatoryException && (
              <InfoRow label="Regulatory Exception" value={extendedProps.regulatoryException} />
            )}
            {extendedProps.message && (
              <InfoRow label="Message" value={extendedProps.message} />
            )}
            {geozoneType && (
              <InfoRow label="Type" value={<TypeBadge type={geozoneType} />} />
            )}
            {/* Geometry details */}
            {extendedProps.subType && (
              <InfoRow label="Sub-type" value={extendedProps.subType} />
            )}
            {extendedProps.radius !== undefined && (
              <InfoRow label="Radius" value={`${extendedProps.radius} m`} />
            )}
          </CollapsibleSection>
          
          {/* TASK-088: Vertical Reference / Altitude Limits */}
          {extendedProps.verticalReference && (
            <CollapsibleSection 
              title="Altitude Limits"
              icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>}
            >
              {extendedProps.verticalReference.upper !== undefined && (
                <InfoRow 
                  label="Upper Limit" 
                  value={`${extendedProps.verticalReference.upper} ${extendedProps.verticalReference.uom || 'm'} ${extendedProps.verticalReference.upperReference ? `(${extendedProps.verticalReference.upperReference})` : ''}`} 
                />
              )}
              {extendedProps.verticalReference.lower !== undefined && (
                <InfoRow 
                  label="Lower Limit" 
                  value={`${extendedProps.verticalReference.lower} ${extendedProps.verticalReference.uom || 'm'} ${extendedProps.verticalReference.lowerReference ? `(${extendedProps.verticalReference.lowerReference})` : ''}`} 
                />
              )}
              {extendedProps.verticalReference.uom && (
                <InfoRow label="Unit" value={extendedProps.verticalReference.uom === 'M' ? 'Meters' : extendedProps.verticalReference.uom === 'FT' ? 'Feet' : extendedProps.verticalReference.uom} />
              )}
            </CollapsibleSection>
          )}
          
          {/* Restriction Conditions - TASK-088: Updated for new format fields */}
          {(extendedProps.restrictions || geozone.restrictions) && (
            <CollapsibleSection 
              title="Restriction Conditions"
              icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            >
              {extendedProps.restrictions?.authorized && (
                <InfoRow 
                  label="Authorization" 
                  value={extendedProps.restrictions.authorized.replace(/_/g, " ")} 
                />
              )}
              {extendedProps.restrictions?.uasOperationMode && (
                <InfoRow 
                  label="Operation Mode" 
                  value={
                    Array.isArray(extendedProps.restrictions.uasOperationMode)
                      ? extendedProps.restrictions.uasOperationMode.join(", ")
                      : extendedProps.restrictions.uasOperationMode
                  } 
                />
              )}
              {extendedProps.restrictions?.uasCategory && (
                <InfoRow 
                  label="UAS Category" 
                  value={
                    Array.isArray(extendedProps.restrictions.uasCategory)
                      ? extendedProps.restrictions.uasCategory.join(", ")
                      : extendedProps.restrictions.uasCategory
                  } 
                />
              )}
              {extendedProps.restrictions?.uasClass && extendedProps.restrictions.uasClass.length > 0 && (
                <InfoRow 
                  label="UAS Classes" 
                  value={extendedProps.restrictions.uasClass.join(", ")} 
                />
              )}
              {extendedProps.restrictions?.maxNoise !== undefined && (
                <InfoRow 
                  label="Max Noise" 
                  value={`${extendedProps.restrictions.maxNoise} dB`} 
                />
              )}
              {/* TASK-088: Handle both specialOperation (new) and specialoperation (legacy) */}
              {(extendedProps.restrictions?.specialOperation || extendedProps.restrictions?.specialoperation) && (
                <InfoRow 
                  label="Special Ops" 
                  value={(extendedProps.restrictions.specialOperation || extendedProps.restrictions.specialoperation)?.replace(/_/g, " ")} 
                />
              )}
              {extendedProps.restrictions?.photograph && (
                <InfoRow 
                  label="Photography" 
                  value={extendedProps.restrictions.photograph.replace(/_/g, " ")} 
                />
              )}
              {/* Altitude restrictions from legacy restrictions object */}
              {geozone.restrictions && (
                <>
                  {geozone.restrictions.minAltitude !== undefined && (
                    <InfoRow 
                      label="Min Altitude" 
                      value={`${geozone.restrictions.minAltitude} ${geozone.restrictions.uomDimensions || "m"}`} 
                    />
                  )}
                  {geozone.restrictions.maxAltitude !== undefined && (
                    <InfoRow 
                      label="Max Altitude" 
                      value={`${geozone.restrictions.maxAltitude} ${geozone.restrictions.uomDimensions || "m"}`} 
                    />
                  )}
                </>
              )}
            </CollapsibleSection>
          )}
          
          {/* Limited Applicability / Validity Period - TASK-088: Updated for new format */}
          {(geozone.temporal_limits || extendedProps.limitedApplicability) && (
            <CollapsibleSection 
              title="Limited Applicability"
              icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            >
              {/* TASK-088: Handle both startDatetime (new) and startDateTime (legacy) */}
              {(geozone.temporal_limits?.startDateTime || 
                extendedProps.limitedApplicability?.startDatetime || 
                extendedProps.limitedApplicability?.startDateTime) && (
                <InfoRow 
                  label="Start" 
                  value={formatDate(
                    geozone.temporal_limits?.startDateTime || 
                    extendedProps.limitedApplicability?.startDatetime ||
                    extendedProps.limitedApplicability?.startDateTime
                  )} 
                />
              )}
              {/* TASK-088: Handle both endDatetime (new) and endDateTime (legacy) */}
              {(geozone.temporal_limits?.endDateTime || 
                extendedProps.limitedApplicability?.endDatetime || 
                extendedProps.limitedApplicability?.endDateTime) && (
                <InfoRow 
                  label="End" 
                  value={formatDate(
                    geozone.temporal_limits?.endDateTime || 
                    extendedProps.limitedApplicability?.endDatetime ||
                    extendedProps.limitedApplicability?.endDateTime
                  )} 
                />
              )}
              {geozone.temporal_limits?.permanentStatus && (
                <InfoRow 
                  label="Status" 
                  value={<span className="text-amber-600 font-medium">Permanent</span>} 
                />
              )}
            </CollapsibleSection>
          )}
          
          {/* Authority Information - TASK-088: Updated for new format fields */}
          {extendedProps.zoneAuthority && (
            <CollapsibleSection 
              title="Authority Information"
              icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
            >
              {extendedProps.zoneAuthority.name && (
                <InfoRow 
                  label="Name" 
                  value={extendedProps.zoneAuthority.name} 
                />
              )}
              {extendedProps.zoneAuthority.service && (
                <InfoRow 
                  label="Service" 
                  value={extendedProps.zoneAuthority.service} 
                />
              )}
              {/* TASK-088: Handle both direct contactName (new) and nested contact.contactName (legacy) */}
              {(extendedProps.zoneAuthority.contactName || extendedProps.zoneAuthority.contact?.contactName) && (
                <InfoRow 
                  label="Contact" 
                  value={
                    extendedProps.zoneAuthority.contactName 
                      ? extendedProps.zoneAuthority.contactName 
                      : `${extendedProps.zoneAuthority.contact?.contactName}${extendedProps.zoneAuthority.contact?.contactRole ? ` (${extendedProps.zoneAuthority.contact.contactRole})` : ""}`
                  } 
                />
              )}
              {extendedProps.zoneAuthority.phone && (
                <InfoRow 
                  label="Phone" 
                  value={
                    <a 
                      href={`tel:${extendedProps.zoneAuthority.phone.replace(/\s/g, "")}`}
                      className="text-blue-500 hover:underline"
                    >
                      {extendedProps.zoneAuthority.phone}
                    </a>
                  } 
                />
              )}
              {extendedProps.zoneAuthority.email && (
                <InfoRow 
                  label="Email" 
                  value={
                    <a 
                      href={`mailto:${extendedProps.zoneAuthority.email}`}
                      className="text-blue-500 hover:underline"
                    >
                      {extendedProps.zoneAuthority.email}
                    </a>
                  } 
                />
              )}
              {/* TASK-088: Handle both SiteURL (new) and siteURL (legacy) */}
              {(extendedProps.zoneAuthority.SiteURL || extendedProps.zoneAuthority.siteURL) && (
                <InfoRow 
                  label="Website" 
                  value={
                    <a 
                      href={extendedProps.zoneAuthority.SiteURL || extendedProps.zoneAuthority.siteURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline truncate block"
                      title={extendedProps.zoneAuthority.SiteURL || extendedProps.zoneAuthority.siteURL}
                    >
                      Visit site →
                    </a>
                  } 
                />
              )}
              {extendedProps.zoneAuthority.purpose && (
                <InfoRow 
                  label="Purpose" 
                  value={extendedProps.zoneAuthority.purpose} 
                />
              )}
              {/* TASK-088: New field - intervalBefore */}
              {extendedProps.zoneAuthority.intervalBefore && (
                <InfoRow 
                  label="Interval Before" 
                  value={extendedProps.zoneAuthority.intervalBefore} 
                />
              )}
            </CollapsibleSection>
          )}
          
          {/* Schedule */}
          {extendedProps.limitedApplicability?.schedule && 
           typeof extendedProps.limitedApplicability.schedule === "object" && (
            <CollapsibleSection 
              title="Schedule"
              icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            >
              {extendedProps.limitedApplicability.schedule.day && (
                <InfoRow 
                  label="Days" 
                  value={Array.isArray(extendedProps.limitedApplicability.schedule.day)
                    ? extendedProps.limitedApplicability.schedule.day.join(", ")
                    : extendedProps.limitedApplicability.schedule.day
                  } 
                />
              )}
              {extendedProps.limitedApplicability.schedule.startTime && 
               extendedProps.limitedApplicability.schedule.startTime !== "null" && (
                <InfoRow 
                  label="Start Time" 
                  value={extendedProps.limitedApplicability.schedule.startTime} 
                />
              )}
              {extendedProps.limitedApplicability.schedule.endTime && 
               extendedProps.limitedApplicability.schedule.endTime !== "null" && (
                <InfoRow 
                  label="End Time" 
                  value={extendedProps.limitedApplicability.schedule.endTime} 
                />
              )}
              {extendedProps.limitedApplicability.schedule.startEvent && 
               extendedProps.limitedApplicability.schedule.startEvent !== "null" && (
                <InfoRow 
                  label="Start Event" 
                  value={extendedProps.limitedApplicability.schedule.startEvent} 
                />
              )}
              {extendedProps.limitedApplicability.schedule.endEvent && 
               extendedProps.limitedApplicability.schedule.endEvent !== "null" && (
                <InfoRow 
                  label="End Event" 
                  value={extendedProps.limitedApplicability.schedule.endEvent} 
                />
              )}
            </CollapsibleSection>
          )}
        </div>
      </div>
    </Popup>
  );
}

/**
 * Standalone popup wrapper for use outside of react-leaflet's component tree
 * This can be used with a marker or programmatically opened popups
 */
export function GeozoneInfoCard({ geozone, onClose }: { geozone: GeozoneData; onClose?: () => void }) {
  const { properties } = geozone;
  
  // TASK-088: Parse extended properties supporting both new WebSocket format and legacy JSON strings
  const extendedProps = useMemo(() => {
    const geo = geozone as GeozoneData & {
      properties: GeozoneData["properties"] & {
        restrictionConditions?: RestrictionConditions | string;
        limitedApplicability?: LimitedApplicability | string;
        zoneAuthority?: ZoneAuthority | string;
        country?: string;
        region?: string;
        identifier?: string;
      };
    };
    
    // Use safeParseOrReturn to handle both objects and JSON strings
    const restrictions = safeParseOrReturn<RestrictionConditions>(
      geo.properties?.restrictionConditions
    );
    
    const limitedApplicability = safeParseOrReturn<LimitedApplicability>(
      geo.properties?.limitedApplicability
    );
    
    const zoneAuthority = safeParseOrReturn<ZoneAuthority>(
      geo.properties?.zoneAuthority
    );
    
    return {
      restrictions,
      limitedApplicability,
      zoneAuthority,
      country: (geo.properties as Record<string, unknown>)?.country as string,
      region: (geo.properties as Record<string, unknown>)?.region as string,
      identifier: geo.uas_geozones_identifier || (geo.properties as Record<string, unknown>)?.identifier as string,
    };
  }, [geozone]);
  
  const geozoneName = properties?.name || geozone.uas_geozones_identifier;
  const geozoneType = properties?.type;
  const typeColor = getTypeColor(geozoneType);
  
  return (
    <div className="bg-[var(--surface-primary)] rounded-lg shadow-lg border border-[var(--border-primary)] overflow-hidden max-w-[400px]">
      {/* Header */}
      <div 
        className="px-4 py-3 flex items-start justify-between"
        style={{ backgroundColor: `${typeColor}15`, borderBottom: `2px solid ${typeColor}` }}
      >
        <div className="flex-1 min-w-0 mr-2">
          <div className="font-bold text-[var(--text-primary)] text-base">
            {extendedProps.identifier || geozone.uas_geozones_identifier}
          </div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5 truncate">
            {geozoneName}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TypeBadge type={geozoneType} />
          {onClose && (
            <button
              onClick={onClose}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Left column */}
        <div>
          {(extendedProps.country || extendedProps.region) && (
            <InfoSection title="Location">
              {extendedProps.country && <InfoRow label="Country" value={extendedProps.country} />}
              {extendedProps.region && <InfoRow label="Region" value={extendedProps.region} />}
            </InfoSection>
          )}
          
          {extendedProps.restrictions && (
            <InfoSection title="Restrictions">
              {extendedProps.restrictions.authorized && (
                <InfoRow 
                  label="Auth" 
                  value={extendedProps.restrictions.authorized.replace(/_/g, " ")} 
                />
              )}
              {extendedProps.restrictions.photograph && (
                <InfoRow 
                  label="Photo" 
                  value={extendedProps.restrictions.photograph.replace(/_/g, " ")} 
                />
              )}
              {/* TASK-088: Handle both specialOperation (new) and specialoperation (legacy) */}
              {(extendedProps.restrictions?.specialOperation || extendedProps.restrictions?.specialoperation) && (
                <InfoRow 
                  label="Special Ops" 
                  value={(extendedProps.restrictions.specialOperation || extendedProps.restrictions.specialoperation)?.replace(/_/g, " ")} 
                />
              )}
            </InfoSection>
          )}
        </div>
        
        {/* Right column */}
        <div>
          {extendedProps.zoneAuthority && (
            <InfoSection title="Contact">
              {extendedProps.zoneAuthority.name && (
                <InfoRow label="Authority" value={extendedProps.zoneAuthority.name} />
              )}
              {/* TASK-088: Handle both direct contactName (new) and nested contact.contactName (legacy) */}
              {(extendedProps.zoneAuthority.contactName || extendedProps.zoneAuthority.contact?.contactName) && (
                <InfoRow label="Contact" value={extendedProps.zoneAuthority.contactName || extendedProps.zoneAuthority.contact?.contactName} />
              )}
              {extendedProps.zoneAuthority.phone && (
                <InfoRow 
                  label="Phone" 
                  value={
                    <a 
                      href={`tel:${extendedProps.zoneAuthority.phone.replace(/\s/g, "")}`}
                      className="text-blue-500 hover:underline"
                    >
                      Call
                    </a>
                  } 
                />
              )}
            </InfoSection>
          )}
          
          {(geozone.temporal_limits || extendedProps.limitedApplicability) && (
            <InfoSection title="Valid">
              {/* TASK-088: Handle both startDatetime (new) and startDateTime (legacy) */}
              {(geozone.temporal_limits?.startDateTime || 
                extendedProps.limitedApplicability?.startDatetime || 
                extendedProps.limitedApplicability?.startDateTime) && (
                <InfoRow 
                  label="From" 
                  value={formatDate(
                    geozone.temporal_limits?.startDateTime || 
                    extendedProps.limitedApplicability?.startDatetime ||
                    extendedProps.limitedApplicability?.startDateTime
                  )} 
                />
              )}
              {/* TASK-088: Handle both endDatetime (new) and endDateTime (legacy) */}
              {(geozone.temporal_limits?.endDateTime || 
                extendedProps.limitedApplicability?.endDatetime || 
                extendedProps.limitedApplicability?.endDateTime) && (
                <InfoRow 
                  label="Until" 
                  value={formatDate(
                    geozone.temporal_limits?.endDateTime || 
                    extendedProps.limitedApplicability?.endDatetime ||
                    extendedProps.limitedApplicability?.endDateTime
                  )} 
                />
              )}
            </InfoSection>
          )}
        </div>
      </div>
    </div>
  );
}

export default GeozoneInfoPopup;
