// app/components/GeoawarenessModal.tsx
//
// GEOAWARENESS CHECK MODAL
// ========================
//
// This modal displays geozone conflicts detected by the geoawareness service.
// It shows:
// - Flight trajectory as a blue polyline
// - Conflicting geozones as colored polygons (based on type)
// - Geozone information popups with detailed restriction data
// - Action buttons to cancel or proceed with authorization

"use client";

import React, { useState } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Button } from './ui/button';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
});

// Geozone type colors (matching the HTML reference)
const GEOZONE_COLORS: { [key: string]: string } = {
  'U-SPACE': '#e41a1c',
  'PROHIBITED': '#4daf4a',
  'REQ_AUTHORIZATION': '#ff7f00',
  'CONDITIONAL': '#a65628',
  'NO_RESTRICTION': '#999999',
};

interface GeozoneFeature {
  id: number | string;
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][] | number[][];
    bbox?: number[];
    verticalReference?: {
      uom: string;
      lower: number;
      upper: number;
      lowerReference: string;
      upperReference: string;
    };
  };
  properties: {
    identifier: string;
    country: string;
    name: string;
    type: string;
    variant: string;
    restrictionConditions: {
      uasClass: string[];
      authorized: string;
      uasCategory: string[] | string;
      uasOperationMode: string[] | string;
      maxNoise?: number;
      specialoperation?: string;
      photograph?: string;
    };
    region: string;
    reasons?: string[];
    otherReasonInfo?: string[];
    regulationExemption?: string;
    message?: string;
    zoneAuthority: {
      name: string;
      service?: string;
      contact?: { contactName: string; contactRole: string };
      siteURL?: string;
      email?: string;
      phone?: string;
      purpose?: string;
      intervalBefore?: string;
    };
    limitedApplicability?: {
      startDateTime: string;
      endDateTime: string;
      schedule?: {
        day: string[];
        startTime: string;
        startEvent?: string;
        endTime: string;
        endEvent?: string;
      };
    };
  };
}

interface GeoawarenessResponse {
  bbox?: number[] | null;
  name: string;
  type: string;
  features: GeozoneFeature[];
  metadata?: any[];
}

interface GeoawarenessModalProps {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
  geozones: GeoawarenessResponse;
  trajectory: [number, number][];
  planName: string;
  hasConflicts: boolean;
  loading?: boolean;
}

// Component to fit map bounds
function FitBounds({ trajectory, geozones }: { trajectory: [number, number][], geozones: GeoawarenessResponse }) {
  const map = useMap();
  
  React.useEffect(() => {
    const bounds: [number, number][] = [];
    
    // Add trajectory points
    trajectory.forEach(point => {
      bounds.push(point);
    });
    
    // Add geozone coordinates
    geozones.features.forEach(feature => {
      if (feature.geometry.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0] as number[][];
        coords.forEach(coord => {
          // Coordinates are [lon, lat], we need [lat, lon]
          bounds.push([coord[1], coord[0]]);
        });
      }
    });
    
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, trajectory, geozones]);
  
  return null;
}

// Custom info icon for markers
const infoIcon = new L.DivIcon({
  className: 'geozone-info-marker',
  html: `<div style="
    background: white;
    border: 2px solid #2c3e50;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  ">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2c3e50" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Get centroid of polygon
function getPolygonCentroid(coordinates: number[][]): [number, number] {
  let latSum = 0, lonSum = 0;
  coordinates.forEach(coord => {
    lonSum += coord[0];
    latSum += coord[1];
  });
  return [latSum / coordinates.length, lonSum / coordinates.length];
}

export default function GeoawarenessModal({
  open,
  onClose,
  onProceed,
  geozones,
  trajectory,
  planName,
  hasConflicts,
  loading = false
}: GeoawarenessModalProps) {
  const [selectedGeozone, setSelectedGeozone] = useState<GeozoneFeature | null>(null);

  if (!open) return null;

  // Calculate center for map
  const getMapCenter = (): [number, number] => {
    if (trajectory.length > 0) {
      const midIdx = Math.floor(trajectory.length / 2);
      return trajectory[midIdx];
    }
    if (geozones.bbox && geozones.bbox.length >= 4) {
      return [(geozones.bbox[1] + geozones.bbox[3]) / 2, (geozones.bbox[0] + geozones.bbox[2]) / 2];
    }
    return [39.47, -0.38]; // Default: Valencia area
  };

  const renderGeozoneInfo = (feature: GeozoneFeature) => {
    const { properties: p } = feature;
    const color = GEOZONE_COLORS[p.type] || GEOZONE_COLORS['CONDITIONAL'];
    
    return (
      <div className="geozone-info-popup" style={{ maxWidth: '400px', fontSize: '12px' }}>
        {/* Header */}
        <div style={{ 
          backgroundColor: color, 
          padding: '8px 12px', 
          borderRadius: '4px 4px 0 0',
          marginBottom: '10px'
        }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
            {p.identifier}
          </h3>
          <div style={{ color: 'white', fontSize: '11px', marginTop: '2px' }}>
            {p.name}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          {/* Left column */}
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '10px' }}>
              <strong style={{ color: '#2c3e50', fontSize: '11px' }}>General Information</strong>
              <p style={{ margin: '4px 0', color: '#34495e' }}><strong>Country:</strong> {p.country}</p>
              <p style={{ margin: '4px 0', color: '#34495e' }}><strong>Region:</strong> {p.region}</p>
              <p style={{ margin: '4px 0', color: '#34495e' }}><strong>Type:</strong> {p.type}</p>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <strong style={{ color: '#2c3e50', fontSize: '11px' }}>Restriction Conditions</strong>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px', fontSize: '10px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '3px', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>Authorization</td>
                    <td style={{ padding: '3px' }}>{p.restrictionConditions.authorized}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '3px', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>UAS Classes</td>
                    <td style={{ padding: '3px' }}>{Array.isArray(p.restrictionConditions.uasClass) ? p.restrictionConditions.uasClass.join(', ') : p.restrictionConditions.uasClass}</td>
                  </tr>
                  {p.restrictionConditions.maxNoise && (
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '3px', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>Max Noise</td>
                      <td style={{ padding: '3px' }}>{p.restrictionConditions.maxNoise} dB</td>
                    </tr>
                  )}
                  {p.restrictionConditions.photograph && (
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '3px', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>Photography</td>
                      <td style={{ padding: '3px' }}>{p.restrictionConditions.photograph}</td>
                    </tr>
                  )}
                  {p.restrictionConditions.specialoperation && (
                    <tr>
                      <td style={{ padding: '3px', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>Special Ops</td>
                      <td style={{ padding: '3px' }}>{p.restrictionConditions.specialoperation}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column */}
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '10px' }}>
              <strong style={{ color: '#2c3e50', fontSize: '11px' }}>Authority Information</strong>
              <p style={{ margin: '4px 0', color: '#34495e' }}><strong>Name:</strong> {p.zoneAuthority.name}</p>
              {p.zoneAuthority.phone && <p style={{ margin: '4px 0', color: '#34495e' }}><strong>Phone:</strong> {p.zoneAuthority.phone}</p>}
              {p.zoneAuthority.email && <p style={{ margin: '4px 0', color: '#34495e' }}><strong>Email:</strong> {p.zoneAuthority.email}</p>}
              {p.zoneAuthority.siteURL && (
                <p style={{ margin: '4px 0', color: '#34495e' }}>
                  <strong>Website:</strong>{' '}
                  <a href={p.zoneAuthority.siteURL} target="_blank" rel="noopener noreferrer" style={{ color: '#3498db' }}>
                    Link
                  </a>
                </p>
              )}
            </div>

            {p.limitedApplicability && (
              <div>
                <strong style={{ color: '#2c3e50', fontSize: '11px' }}>Applicability</strong>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px', fontSize: '10px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '3px', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>Start</td>
                      <td style={{ padding: '3px' }}>{p.limitedApplicability.startDateTime}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '3px', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>End</td>
                      <td style={{ padding: '3px' }}>{p.limitedApplicability.endDateTime}</td>
                    </tr>
                    {p.limitedApplicability.schedule && (
                      <tr>
                        <td style={{ padding: '3px', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>Days</td>
                        <td style={{ padding: '3px' }}>{p.limitedApplicability.schedule.day.join(', ')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Vertical reference if available */}
        {feature.geometry.verticalReference && (
          <div style={{ marginTop: '10px', padding: '5px', backgroundColor: '#f9f9f9', borderRadius: '3px' }}>
            <strong style={{ color: '#2c3e50', fontSize: '11px' }}>Altitude Limits</strong>
            <p style={{ margin: '4px 0', color: '#34495e', fontSize: '10px' }}>
              <strong>Lower:</strong> {feature.geometry.verticalReference.lower} {feature.geometry.verticalReference.uom} ({feature.geometry.verticalReference.lowerReference})
              {' | '}
              <strong>Upper:</strong> {feature.geometry.verticalReference.upper} {feature.geometry.verticalReference.uom} ({feature.geometry.verticalReference.upperReference})
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        style={{ 
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '24px',
          width: '70vw',
          maxWidth: '1200px',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            color: '#6b7280'
          }}
          aria-label="Cerrar"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          marginBottom: '15px',
          padding: '12px 16px',
          backgroundColor: hasConflicts ? '#fff3cd' : '#d4edda',
          borderRadius: '8px',
          border: `1px solid ${hasConflicts ? '#ffc107' : '#28a745'}`
        }}>
          {hasConflicts ? (
            <AlertTriangle size={24} color="#856404" />
          ) : (
            <CheckCircle size={24} color="#155724" />
          )}
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: hasConflicts ? '#856404' : '#155724' }}>
              {hasConflicts 
                ? `Geozona(s) detectada(s) - ${planName}` 
                : `Sin conflictos de geozonas - ${planName}`
              }
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: hasConflicts ? '#856404' : '#155724' }}>
              {hasConflicts 
                ? `Se han detectado ${geozones.features.length} geozona(s) que interfieren con tu trayectoria de vuelo.`
                : 'Tu trayectoria de vuelo no interfiere con ninguna geozona restringida.'
              }
            </p>
          </div>
        </div>

        {/* Map */}
        <div style={{ 
          height: '50vh', 
          minHeight: '350px',
          maxHeight: '500px',
          borderRadius: '8px', 
          overflow: 'hidden', 
          border: '1px solid #ccc',
          position: 'relative',
          zIndex: 1
        }}>
          <MapContainer
            center={getMapCenter()}
            zoom={13}
            style={{ height: '100%', width: '100%', zIndex: 1 }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <FitBounds trajectory={trajectory} geozones={geozones} />
            
            {/* Flight trajectory */}
            {trajectory.length > 1 && (
              <Polyline
                positions={trajectory}
                pathOptions={{ 
                  color: '#2196F3', 
                  weight: 4,
                  opacity: 0.8
                }}
              />
            )}

            {/* Start marker */}
            {trajectory.length > 0 && (
              <Marker position={trajectory[0]}>
                <Popup>Inicio de trayectoria</Popup>
              </Marker>
            )}

            {/* End marker */}
            {trajectory.length > 1 && (
              <Marker position={trajectory[trajectory.length - 1]}>
                <Popup>Fin de trayectoria</Popup>
              </Marker>
            )}

            {/* Geozones */}
            {geozones.features.map((feature, idx) => {
              if (feature.geometry.type !== 'Polygon') return null;
              
              const coords = feature.geometry.coordinates[0] as number[][];
              // Convert [lon, lat] to [lat, lon] for Leaflet
              const positions: [number, number][] = coords.map(c => [c[1], c[0]]);
              const color = GEOZONE_COLORS[feature.properties.type] || GEOZONE_COLORS['CONDITIONAL'];
              const centroid = getPolygonCentroid(coords);
              
              return (
                <React.Fragment key={`geozone-${idx}`}>
                  <Polygon
                    positions={positions}
                    pathOptions={{
                      color: 'black',
                      fillColor: color,
                      fillOpacity: 0.4,
                      weight: 2,
                      opacity: 0.8
                    }}
                  />
                  <Marker 
                    position={[centroid[0], centroid[1]]}
                    icon={infoIcon}
                  >
                    <Popup maxWidth={450}>
                      {renderGeozoneInfo(feature)}
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}
          </MapContainer>
        </div>

        {/* Legend */}
        <div style={{ 
          marginTop: '15px', 
          padding: '12px 16px', 
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <strong style={{ fontSize: '13px', marginBottom: '8px', display: 'block', color: '#343a40' }}>Leyenda</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: '#2196F3', borderRadius: '3px', border: '1px solid rgba(0,0,0,0.1)' }}></div>
              <span style={{ color: '#495057' }}>Trayectoria de vuelo</span>
            </div>
            {Object.entries(GEOZONE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '16px', backgroundColor: color, borderRadius: '3px', border: '1px solid rgba(0,0,0,0.1)' }}></div>
                <span style={{ color: '#495057' }}>{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '10px', 
          marginTop: '20px',
          paddingTop: '15px',
          borderTop: '1px solid #eee'
        }}>
          <Button
            onClick={onClose}
            variant="outline"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              backgroundColor: hasConflicts ? '#dc3545' : 'transparent',
              borderColor: hasConflicts ? '#dc3545' : '#6c757d',
              color: hasConflicts ? 'white' : '#6c757d'
            }}
          >
            <X size={16} />
            Cancelar {hasConflicts && '(Recomendado)'}
          </Button>
          <Button
            onClick={onProceed}
            disabled={loading}
            variant={hasConflicts ? "outline" : "default"}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              backgroundColor: hasConflicts ? 'transparent' : '#28a745',
              borderColor: hasConflicts ? '#6c757d' : '#28a745',
              color: hasConflicts ? '#6c757d' : 'white'
            }}
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Enviando...
              </>
            ) : hasConflicts ? (
              <>
                <AlertTriangle size={16} />
                Solicitar igualmente
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Solicitar autorización
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
