/**
 * SCAN Pattern Generator V2 - Step-by-Step Wizard
 * ================================================
 * 
 * Redesigned with a guided workflow:
 * 1. Set Takeoff Point (click on map)
 * 2. Draw Polygon Area (click to add vertices, click first vertex or button to close)
 * 3. Set Landing Point (click on map)
 * 4. Configure Parameters (altitude, spacing, angle)
 * 5. Preview & Apply
 * 
 * TASK-216: This component uses refs for stable map click handlers to avoid
 * stale closure issues. The mapClickHandler ref provides a stable callback
 * that dispatches to the appropriate step handler based on current state.
 */

"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Trash2,
  RotateCcw,
  Play,
  X,
  Target,
  Flag,
  Grid3X3,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  ChevronRight,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import {
  ScanConfig,
  Point,
  ScanWaypoint,
  ScanStatistics,
  ScanValidation,
  validateScanConfig,
  generateScanWaypoints,
  polygonArea,
  normalizeAngle,
} from "@/lib/scan-generator";

// ============================================================================
// TYPES
// ============================================================================

export type ScanStep = 1 | 2 | 3 | 4; // 1: Takeoff, 2: Polygon, 3: Landing, 4: Parameters

export interface ScanPatternGeneratorV2Props {
  /** Callback when waypoints are generated and applied */
  onApply: (waypoints: ScanWaypoint[]) => void;
  /** Callback when the generator is cancelled */
  onCancel: () => void;
  /** Service area bounds for validation [minLng, minLat, maxLng, maxLat] */
  serviceBounds?: [number, number, number, number];
  /** Callback when map click should be handled - uses ref internally for stability */
  onMapClick?: (callback: ((lat: number, lng: number) => void) | null) => void;
  /** Callback to update map overlays */
  onOverlaysChange?: (overlays: {
    takeoffPoint: Point | null;
    landingPoint: Point | null;
    polygonVertices: Point[];
    polygonClosed: boolean;
    previewWaypoints: ScanWaypoint[];
    scanAngle: number;
  }) => void;
  /** Callback to register drag handlers for external updates (e.g. map marker drag) */
  onDragHandlers?: (handlers: {
    updateTakeoff: (lat: number, lng: number) => void;
    updateLanding: (lat: number, lng: number) => void;
    updateVertex: (index: number, lat: number, lng: number) => void;
  } | null) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(0)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(0)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes < 60) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) {
    return `${sqMeters.toFixed(0)} m²`;
  }
  return `${(sqMeters / 10000).toFixed(2)} ha`;
}

function isWithinBounds(
  lat: number,
  lng: number,
  bounds?: [number, number, number, number]
): boolean {
  if (!bounds) return true;
  const [minLng, minLat, maxLng, maxLat] = bounds;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/** Inline editable coordinate pair */
function EditableCoord({
  lat,
  lng,
  onChange,
  serviceBounds,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  serviceBounds?: [number, number, number, number];
}) {
  const [localLat, setLocalLat] = React.useState(lat.toFixed(6));
  const [localLng, setLocalLng] = React.useState(lng.toFixed(6));
  const [error, setError] = React.useState<string | null>(null);

  // Sync when external value changes (e.g. map click sets new point)
  React.useEffect(() => {
    setLocalLat(lat.toFixed(6));
    setLocalLng(lng.toFixed(6));
    setError(null);
  }, [lat, lng]);

  const commit = (newLat: string, newLng: string) => {
    const parsedLat = parseFloat(newLat);
    const parsedLng = parseFloat(newLng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setError("Invalid number");
      return;
    }
    if (parsedLat < -90 || parsedLat > 90) {
      setError("Lat must be -90..90");
      return;
    }
    if (parsedLng < -180 || parsedLng > 180) {
      setError("Lng must be -180..180");
      return;
    }
    if (!isWithinBounds(parsedLat, parsedLng, serviceBounds)) {
      setError("Outside service area");
      return;
    }
    setError(null);
    onChange(parsedLat, parsedLng);
  };

  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-zinc-500 w-6">Lat</label>
        <input
          type="number"
          step="0.000001"
          value={localLat}
          onChange={(e) => setLocalLat(e.target.value)}
          onBlur={() => commit(localLat, localLng)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(localLat, localLng); }}
          className="flex-1 px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 w-24"
        />
        <label className="text-[10px] text-zinc-500 w-6">Lng</label>
        <input
          type="number"
          step="0.000001"
          value={localLng}
          onChange={(e) => setLocalLng(e.target.value)}
          onBlur={() => commit(localLat, localLng)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(localLat, localLng); }}
          className="flex-1 px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 w-24"
        />
      </div>
      {error && (
        <p className="text-[10px] text-red-400">{error}</p>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ScanPatternGeneratorV2({
  onApply,
  onCancel,
  serviceBounds,
  onMapClick,
  onOverlaysChange,
  onDragHandlers,
}: ScanPatternGeneratorV2Props) {
  // ---- State ----
  
  // Step-based workflow
  const [currentStep, setCurrentStep] = useState<ScanStep>(1);
  
  // Step 1: Takeoff point
  const [takeoffPoint, setTakeoffPoint] = useState<Point | null>(null);
  
  // Step 2: Polygon
  const [polygonVertices, setPolygonVertices] = useState<Point[]>([]);
  const [polygonClosed, setPolygonClosed] = useState(false);
  
  // Step 3: Landing point
  const [landingPoint, setLandingPoint] = useState<Point | null>(null);
  
  // Step 4: Parameters
  const [altitude, setAltitude] = useState<number>(100);
  const [spacing, setSpacing] = useState<number>(20);
  const [angle, setAngle] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Preview
  const [previewWaypoints, setPreviewWaypoints] = useState<ScanWaypoint[]>([]);
  const [statistics, setStatistics] = useState<ScanStatistics | null>(null);
  const [validation, setValidation] = useState<ScanValidation | null>(null);
  
  // ---- TASK-216: Refs for stable handler management ----
  // Store onMapClick in a ref to avoid dependency issues in the main click handler
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);
  
  // Store all state needed by click handlers in refs to avoid stale closures
  const stateRef = useRef({
    currentStep,
    takeoffPoint,
    polygonVertices,
    polygonClosed,
    landingPoint,
  });
  
  // Update state ref whenever state changes
  useEffect(() => {
    stateRef.current = {
      currentStep,
      takeoffPoint,
      polygonVertices,
      polygonClosed,
      landingPoint,
    };
  }, [currentStep, takeoffPoint, polygonVertices, polygonClosed, landingPoint]);
  
  // Store serviceBounds in ref for validation in click handler
  const serviceBoundsRef = useRef(serviceBounds);
  useEffect(() => {
    serviceBoundsRef.current = serviceBounds;
  }, [serviceBounds]);

  // ---- TASK-216: Single stable map click handler using refs ----
  // This handler is created once and uses refs to access current state,
  // avoiding stale closure issues that occur with callback props
  const stableMapClickHandler = useCallback((lat: number, lng: number) => {
    // Access current state from ref
    const state = stateRef.current;
    const bounds = serviceBoundsRef.current;
    
    // Validate bounds
    if (bounds) {
      const [minLng, minLat, maxLng, maxLat] = bounds;
      if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
        return; // Outside service area
      }
    }
    
    // Dispatch based on current step
    if (state.currentStep === 1 && !state.takeoffPoint) {
      // Step 1: Set takeoff point
      setTakeoffPoint({ lat, lng });
      setCurrentStep(2);
    } else if (state.currentStep === 2 && !state.polygonClosed) {
      // Step 2: Add polygon vertex
      const newVertex: Point = { lat, lng };
      const currentVertices = state.polygonVertices;
      
      // Check if clicking near first vertex to close polygon
      if (currentVertices.length >= 3) {
        const firstVertex = currentVertices[0];
        const distance = Math.sqrt(
          Math.pow((lat - firstVertex.lat) * 111320, 2) +
          Math.pow((lng - firstVertex.lng) * 111320 * Math.cos(lat * Math.PI / 180), 2)
        );
        
        // If within 30 meters of first vertex, close the polygon
        if (distance < 30) {
          setPolygonClosed(true);
          setCurrentStep(3);
          return;
        }
      }
      
      setPolygonVertices(prev => [...prev, newVertex]);
    } else if (state.currentStep === 3 && !state.landingPoint) {
      // Step 3: Set landing point
      setLandingPoint({ lat, lng });
      setCurrentStep(4);
    }
    // Step 4 (parameters) doesn't need map clicks
  }, []); // Empty deps - uses refs for all state access

  // ---- Set up map click handler ----
  // TASK-216: Use a stable reference that doesn't change between renders
  const hasActiveClickTarget = useCallback(() => {
    const state = stateRef.current;
    return (
      (state.currentStep === 1 && !state.takeoffPoint) ||
      (state.currentStep === 2 && !state.polygonClosed) ||
      (state.currentStep === 3 && !state.landingPoint)
    );
  }, []);
  
  useEffect(() => {
    if (!onMapClick) return;
    
    // Always provide the stable handler when there's an active click target
    // The handler itself checks state to determine what action to take
    if (hasActiveClickTarget()) {
      onMapClick(stableMapClickHandler);
    } else {
      onMapClick(null);
    }
    
    // Cleanup on unmount only
    return () => {
      onMapClick(null);
    };
  }, [onMapClick, stableMapClickHandler, hasActiveClickTarget, 
      // Re-evaluate when these change to update whether we need click handling
      currentStep, takeoffPoint, polygonClosed, landingPoint]);

  // ---- Generate preview when all data is ready ----
  
  useEffect(() => {
    if (!takeoffPoint || !polygonClosed || polygonVertices.length < 3) {
      setPreviewWaypoints([]);
      setStatistics(null);
      setValidation(null);
      return;
    }

    const config: ScanConfig = {
      polygon: { vertices: polygonVertices },
      altitude,
      spacing,
      angle: normalizeAngle(angle),
      startPoint: takeoffPoint,
      endPoint: landingPoint ?? undefined,
      speed,
    };

    const result = validateScanConfig(config);
    setValidation(result);

    if (result.isValid) {
      try {
        const scanResult = generateScanWaypoints(config);
        setStatistics(scanResult.statistics);
        setPreviewWaypoints(scanResult.waypoints);
      } catch (err) {
        console.error("Error generating SCAN pattern:", err);
        setStatistics(null);
        setPreviewWaypoints([]);
      }
    } else {
      setStatistics(null);
      setPreviewWaypoints([]);
    }
  }, [takeoffPoint, landingPoint, polygonVertices, polygonClosed, altitude, spacing, angle, speed]);

  // ---- Update map overlays ----
  
  useEffect(() => {
    onOverlaysChange?.({
      takeoffPoint,
      landingPoint,
      polygonVertices,
      polygonClosed,
      previewWaypoints,
      scanAngle: angle,
    });
  }, [takeoffPoint, landingPoint, polygonVertices, polygonClosed, previewWaypoints, angle, onOverlaysChange]);

  // ---- Actions ----
  
  const handleClosePolygon = useCallback(() => {
    if (polygonVertices.length >= 3) {
      setPolygonClosed(true);
      setCurrentStep(3);
    }
  }, [polygonVertices]);

  const handleDeleteVertex = useCallback((index: number) => {
    setPolygonVertices(prev => prev.filter((_, i) => i !== index));
    if (polygonClosed) {
      setPolygonClosed(false);
    }
  }, [polygonClosed]);

  const handleVertexUpdate = useCallback((index: number, lat: number, lng: number) => {
    setPolygonVertices(prev => prev.map((v, i) => (i === index ? { lat, lng } : v)));
  }, []);

  // ---- Expose drag handlers to parent for map marker drag events ----
  const handleExternalTakeoffUpdate = useCallback((lat: number, lng: number) => {
    setTakeoffPoint({ lat, lng });
  }, []);

  const handleExternalLandingUpdate = useCallback((lat: number, lng: number) => {
    setLandingPoint({ lat, lng });
  }, []);

  useEffect(() => {
    if (!onDragHandlers) return;
    onDragHandlers({
      updateTakeoff: handleExternalTakeoffUpdate,
      updateLanding: handleExternalLandingUpdate,
      updateVertex: handleVertexUpdate,
    });
    return () => { onDragHandlers(null); };
  }, [onDragHandlers, handleExternalTakeoffUpdate, handleExternalLandingUpdate, handleVertexUpdate]);

  const handleClearPolygon = useCallback(() => {
    setPolygonVertices([]);
    setPolygonClosed(false);
  }, []);

  const handleClearAll = useCallback(() => {
    setTakeoffPoint(null);
    setPolygonVertices([]);
    setPolygonClosed(false);
    setLandingPoint(null);
    setPreviewWaypoints([]);
    setStatistics(null);
    setCurrentStep(1);
  }, []);

  const handleApply = useCallback(() => {
    if (previewWaypoints.length > 0) {
      onApply(previewWaypoints);
    }
  }, [previewWaypoints, onApply]);

  const canApply = previewWaypoints.length > 0 && validation?.isValid;
  const areaValue = polygonVertices.length >= 3 ? polygonArea({ vertices: polygonVertices }) : 0;

  // ---- Step Navigation ----
  
  const goToStep = (step: ScanStep) => {
    // Only allow going to steps that are completed or the next available
    if (step === 1) setCurrentStep(1);
    else if (step === 2 && takeoffPoint) setCurrentStep(2);
    else if (step === 3 && polygonClosed) setCurrentStep(3);
    else if (step === 4 && (landingPoint || polygonClosed)) setCurrentStep(4);
  };

  const getStepStatus = (step: ScanStep): 'completed' | 'current' | 'pending' => {
    if (step < currentStep) {
      // Check if step is actually complete
      if (step === 1 && takeoffPoint) return 'completed';
      if (step === 2 && polygonClosed) return 'completed';
      if (step === 3 && landingPoint) return 'completed';
      return 'pending';
    }
    if (step === currentStep) return 'current';
    return 'pending';
  };

  // ---- Render ----

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">SCAN Pattern Generator</h3>
        </div>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Step Indicator */}
      <div className="px-4 py-3 border-b border-zinc-700 bg-zinc-800/50">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((step) => {
            const status = getStepStatus(step as ScanStep);
            const labels = ['Takeoff', 'Polygon', 'Landing', 'Parameters'];
            const icons = [Target, Pencil, Flag, Grid3X3];
            const Icon = icons[step - 1];
            
            return (
              <React.Fragment key={step}>
                <button
                  onClick={() => goToStep(step as ScanStep)}
                  className={`flex flex-col items-center gap-1 px-2 py-1 rounded transition-colors ${
                    status === 'current' 
                      ? 'text-purple-400' 
                      : status === 'completed'
                      ? 'text-green-400 cursor-pointer hover:text-green-300'
                      : 'text-zinc-500 cursor-not-allowed'
                  }`}
                  disabled={status === 'pending'}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    status === 'current' 
                      ? 'border-purple-400 bg-purple-900/30' 
                      : status === 'completed'
                      ? 'border-green-400 bg-green-900/30'
                      : 'border-zinc-600 bg-zinc-800'
                  }`}>
                    {status === 'completed' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-xs font-medium">{labels[step - 1]}</span>
                </button>
                {step < 4 && (
                  <ChevronRight className={`w-4 h-4 ${
                    getStepStatus((step + 1) as ScanStep) !== 'pending' 
                      ? 'text-green-400' 
                      : 'text-zinc-600'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
        
        {/* Step 1: Takeoff Point */}
        {currentStep === 1 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-purple-400">
              <Target className="w-5 h-5" />
              <span className="font-medium">Step 1: Set Takeoff Point</span>
            </div>
            
            <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3">
              <p className="text-sm text-purple-200">
                👆 <strong>Click on the map</strong> to set the takeoff/start location for your drone.
              </p>
            </div>
            
            {takeoffPoint && (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm">Takeoff point set</span>
                  </div>
                  <button
                    onClick={() => setTakeoffPoint(null)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <EditableCoord
                  lat={takeoffPoint.lat}
                  lng={takeoffPoint.lng}
                  onChange={(lat, lng) => setTakeoffPoint({ lat, lng })}
                  serviceBounds={serviceBounds}
                />
              </div>
            )}
            
            {takeoffPoint && (
              <button
                onClick={() => setCurrentStep(2)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Continue to Draw Polygon
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Step 2: Draw Polygon */}
        {currentStep === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-purple-400">
              <Pencil className="w-5 h-5" />
              <span className="font-medium">Step 2: Draw Survey Area</span>
            </div>
            
            {!polygonClosed ? (
              <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3 space-y-2">
                <p className="text-sm text-purple-200">
                  👆 <strong>Click on the map</strong> to add polygon vertices.
                </p>
                <p className="text-xs text-zinc-400">
                  • Add at least 3 points to form a polygon<br />
                  • Click near the first point to close the polygon<br />
                  • Or use the &quot;Close Polygon&quot; button below
                </p>
              </div>
            ) : (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">Polygon closed ({polygonVertices.length} vertices)</span>
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  Area: {formatArea(areaValue)}
                </div>
              </div>
            )}
            
            {/* Vertices List */}
            {polygonVertices.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300">
                    Vertices ({polygonVertices.length})
                  </label>
                  <button
                    onClick={handleClearPolygon}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 bg-zinc-800 rounded p-2">
                  {polygonVertices.map((v, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-1.5 rounded hover:bg-zinc-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 font-mono text-xs">{idx + 1}</span>
                        <button
                          onClick={() => handleDeleteVertex(idx)}
                          className="p-1 rounded hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Delete vertex"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <EditableCoord
                        lat={v.lat}
                        lng={v.lng}
                        onChange={(lat, lng) => handleVertexUpdate(idx, lat, lng)}
                        serviceBounds={serviceBounds}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Close Polygon Button */}
            {!polygonClosed && polygonVertices.length >= 3 && (
              <button
                onClick={handleClosePolygon}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Close Polygon ({polygonVertices.length} vertices)
              </button>
            )}
            
            {polygonClosed && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPolygonClosed(false);
                  }}
                  className="flex-1 px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 transition-colors text-sm"
                >
                  Edit Polygon
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Landing Point */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-purple-400">
              <Flag className="w-5 h-5" />
              <span className="font-medium">Step 3: Set Landing Point</span>
            </div>
            
            <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3 space-y-2">
              <p className="text-sm text-purple-200">
                👆 <strong>Click on the map</strong> to set the landing location.
              </p>
              <p className="text-xs text-zinc-400">
                This is where the drone will land after completing the survey.
              </p>
            </div>
            
            {landingPoint && (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm">Landing point set</span>
                  </div>
                  <button
                    onClick={() => setLandingPoint(null)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <EditableCoord
                  lat={landingPoint.lat}
                  lng={landingPoint.lng}
                  onChange={(lat, lng) => setLandingPoint({ lat, lng })}
                  serviceBounds={serviceBounds}
                />
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentStep(4)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  landingPoint 
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {landingPoint ? 'Continue to Parameters' : 'Skip (Use Last Waypoint)'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Parameters & Preview */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-purple-400">
              <Grid3X3 className="w-5 h-5" />
              <span className="font-medium">Step 4: Configure & Generate</span>
            </div>

            {/* Parameters */}
            <div className="space-y-3">
              {/* Altitude */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-300">
                  Flight Altitude
                  <span className="text-xs text-zinc-500 ml-2">(0-200m)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={altitude}
                    onChange={(e) => setAltitude(Math.max(0, Math.min(200, Number(e.target.value))))}
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-zinc-400 w-8">m</span>
                </div>
              </div>

              {/* Spacing */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-300">
                  Line Spacing
                  <span className="text-xs text-zinc-500 ml-2">(distance between scan lines)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    step={1}
                    value={spacing}
                    onChange={(e) => setSpacing(Math.max(1, Math.min(500, Number(e.target.value))))}
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-zinc-400 w-8">m</span>
                </div>
              </div>

              {/* Angle */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-300">
                  Scan Angle
                  <span className="text-xs text-zinc-500 ml-2">(0° = North)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={angle}
                    onChange={(e) => setAngle(normalizeAngle(Number(e.target.value)))}
                    className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-zinc-400 w-4">°</span>
                </div>
                
                {/* Compass indicator */}
                <div className="flex items-center justify-center mt-2">
                  <div className="relative w-14 h-14 border-2 border-zinc-600 rounded-full">
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500">N</span>
                    <span className="absolute top-1/2 -right-2.5 -translate-y-1/2 text-[9px] text-zinc-500">E</span>
                    <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500">S</span>
                    <span className="absolute top-1/2 -left-2.5 -translate-y-1/2 text-[9px] text-zinc-500">W</span>
                    <div
                      className="absolute top-1/2 left-1/2 w-0.5 h-5 bg-purple-500 origin-bottom"
                      style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)` }}
                    >
                      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-purple-500 rotate-45" />
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-zinc-400 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Advanced Options */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Advanced Options
              </button>

              {showAdvanced && (
                <div className="space-y-3 pl-2 border-l-2 border-zinc-700">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-zinc-300">
                      Speed
                      <span className="text-xs text-zinc-500 ml-2">(m/s)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        step={0.5}
                        value={speed}
                        onChange={(e) => setSpeed(Math.max(1, Math.min(30, Number(e.target.value))))}
                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="text-xs text-zinc-400 w-8">m/s</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Validation Messages */}
            {validation && validation.errors.length > 0 && (
              <div className="bg-red-900/30 border border-red-700 rounded p-3">
                <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1">
                  <AlertCircle className="w-4 h-4" />
                  Errors
                </div>
                <ul className="text-xs text-red-300 space-y-1 list-disc list-inside">
                  {validation.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {validation && validation.warnings.length > 0 && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3">
                <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-1">
                  <AlertCircle className="w-4 h-4" />
                  Warnings
                </div>
                <ul className="text-xs text-yellow-300 space-y-1 list-disc list-inside">
                  {validation.warnings.map((warn, idx) => (
                    <li key={idx}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Statistics Preview */}
            {statistics && (
              <div className="bg-zinc-800 border border-zinc-700 rounded p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Pattern Generated Successfully
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Waypoints:</span>
                    <span className="text-white font-medium">{statistics.waypointCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Scan Lines:</span>
                    <span className="text-white font-medium">{statistics.scanLineCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Distance:</span>
                    <span className="text-white font-medium">{formatDistance(statistics.totalDistance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Est. Time:</span>
                    <span className="text-white font-medium">{formatTime(statistics.estimatedFlightTime)}</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-zinc-400">Coverage Area:</span>
                    <span className="text-white font-medium">{formatArea(statistics.coverageArea)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-zinc-700 bg-zinc-800/50">
        <button
          onClick={handleClearAll}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Start Over
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-sm font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!canApply}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            Apply Pattern
          </button>
        </div>
      </div>
    </div>
  );
}
