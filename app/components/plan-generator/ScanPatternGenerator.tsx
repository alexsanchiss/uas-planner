/**
 * SCAN Pattern Generator Component
 * =================================
 * 
 * This component provides a UI for generating SCAN (survey) flight patterns.
 * Users can draw a polygon on the map, set parameters, and generate waypoints.
 * 
 * TASK-131: Create ScanPatternGenerator.tsx component
 * TASK-132: Implement polygon drawing tool
 * TASK-133: Add polygon editing (drag vertices, delete vertices)
 * TASK-134: Add start point selection on map
 * TASK-135: Add end point selection on map
 * TASK-136: Create altitude input for SCAN pattern
 * TASK-137: Create spacing input (meters between parallel lines)
 * TASK-138: Create angle input (0-360 degrees)
 * TASK-139: Create angle visual indicator on map
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  MapPin,
  Trash2,
  RotateCcw,
  Play,
  X,
  Pencil,
  Target,
  Flag,
  Grid3X3,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
} from "lucide-react";
import {
  ScanConfig,
  Point,
  Polygon,
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

export type ScanMode = "idle" | "drawing" | "editing" | "setStart" | "setEnd";

export interface ScanPatternGeneratorProps {
  /** Callback when waypoints are generated and applied */
  onApply: (waypoints: ScanWaypoint[]) => void;
  /** Callback when the generator is cancelled */
  onCancel: () => void;
  /** Callback when polygon vertices change (for map display) */
  onPolygonChange: (vertices: Point[]) => void;
  /** Callback when start point changes (for map display) */
  onStartPointChange: (point: Point | null) => void;
  /** Callback when end point changes (for map display) */
  onEndPointChange: (point: Point | null) => void;
  /** Callback when angle changes (for map display) */
  onAngleChange: (angle: number) => void;
  /** Callback when mode changes (for map interaction) */
  onModeChange: (mode: ScanMode) => void;
  /** Current mode (controlled by parent for map interactions) */
  mode: ScanMode;
  /** Service area bounds for validation [minLng, minLat, maxLng, maxLat] */
  serviceBounds?: [number, number, number, number];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format distance for display
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(0)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Format time for display
 */
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

/**
 * Format area for display
 */
function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) {
    return `${sqMeters.toFixed(0)} m²`;
  }
  return `${(sqMeters / 10000).toFixed(2)} ha`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ScanPatternGenerator({
  onApply,
  onCancel,
  onPolygonChange,
  onStartPointChange,
  onEndPointChange,
  onAngleChange,
  onModeChange,
  mode,
  serviceBounds,
}: ScanPatternGeneratorProps) {
  // ---- State ----
  
  // Polygon vertices
  const [vertices, setVertices] = useState<Point[]>([]);
  
  // Start and end points
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  
  // SCAN parameters
  const [altitude, setAltitude] = useState<number>(100);
  const [spacing, setSpacing] = useState<number>(20);
  const [angle, setAngle] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(5);
  
  // UI state
  const [validation, setValidation] = useState<ScanValidation | null>(null);
  const [statistics, setStatistics] = useState<ScanStatistics | null>(null);
  const [previewWaypoints, setPreviewWaypoints] = useState<ScanWaypoint[]>([]);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [selectedVertexIdx, setSelectedVertexIdx] = useState<number | null>(null);

  // ---- Effects ----

  // Notify parent when polygon changes
  useEffect(() => {
    onPolygonChange(vertices);
  }, [vertices, onPolygonChange]);

  // Notify parent when start point changes
  useEffect(() => {
    onStartPointChange(startPoint);
  }, [startPoint, onStartPointChange]);

  // Notify parent when end point changes
  useEffect(() => {
    onEndPointChange(endPoint);
  }, [endPoint, onEndPointChange]);

  // Notify parent when angle changes
  useEffect(() => {
    onAngleChange(angle);
  }, [angle, onAngleChange]);

  // Validate and update preview when parameters change
  useEffect(() => {
    if (vertices.length < 3) {
      setValidation(null);
      setStatistics(null);
      setPreviewWaypoints([]);
      return;
    }

    const config: ScanConfig = {
      polygon: { vertices },
      altitude,
      spacing,
      angle: normalizeAngle(angle),
      startPoint: startPoint ?? undefined,
      endPoint: endPoint ?? undefined,
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
  }, [vertices, altitude, spacing, angle, startPoint, endPoint, speed]);

  // ---- Handlers ----

  /**
   * Handle adding a new vertex (called from map click)
   * TASK-132: Polygon drawing
   */
  const handleAddVertex = useCallback((point: Point) => {
    // Validate against service bounds if provided
    if (serviceBounds) {
      const [minLng, minLat, maxLng, maxLat] = serviceBounds;
      if (point.lat < minLat || point.lat > maxLat || point.lng < minLng || point.lng > maxLng) {
        // Point outside service area - don't add
        return false;
      }
    }
    setVertices(prev => [...prev, point]);
    return true;
  }, [serviceBounds]);

  /**
   * Handle updating a vertex position (called from map drag)
   * TASK-133: Polygon editing
   */
  const handleUpdateVertex = useCallback((index: number, point: Point) => {
    // Validate against service bounds if provided
    if (serviceBounds) {
      const [minLng, minLat, maxLng, maxLat] = serviceBounds;
      if (point.lat < minLat || point.lat > maxLat || point.lng < minLng || point.lng > maxLng) {
        return false;
      }
    }
    setVertices(prev => prev.map((v, i) => (i === index ? point : v)));
    return true;
  }, [serviceBounds]);

  /**
   * Handle deleting a vertex
   * TASK-133: Polygon editing
   */
  const handleDeleteVertex = useCallback((index: number) => {
    setVertices(prev => prev.filter((_, i) => i !== index));
    setSelectedVertexIdx(null);
  }, []);

  /**
   * Handle setting start point
   * TASK-134: Start point selection
   */
  const handleSetStartPoint = useCallback((point: Point) => {
    // Validate against service bounds if provided
    if (serviceBounds) {
      const [minLng, minLat, maxLng, maxLat] = serviceBounds;
      if (point.lat < minLat || point.lat > maxLat || point.lng < minLng || point.lng > maxLng) {
        return false;
      }
    }
    setStartPoint(point);
    onModeChange("idle");
    return true;
  }, [serviceBounds, onModeChange]);

  /**
   * Handle setting end point
   * TASK-135: End point selection
   */
  const handleSetEndPoint = useCallback((point: Point) => {
    // Validate against service bounds if provided
    if (serviceBounds) {
      const [minLng, minLat, maxLng, maxLat] = serviceBounds;
      if (point.lat < minLat || point.lat > maxLat || point.lng < minLng || point.lng > maxLng) {
        return false;
      }
    }
    setEndPoint(point);
    onModeChange("idle");
    return true;
  }, [serviceBounds, onModeChange]);

  /**
   * Clear all data
   */
  const handleClear = useCallback(() => {
    setVertices([]);
    setStartPoint(null);
    setEndPoint(null);
    setSelectedVertexIdx(null);
    onModeChange("idle");
  }, [onModeChange]);

  /**
   * Apply generated waypoints
   */
  const handleApply = useCallback(() => {
    if (previewWaypoints.length > 0) {
      onApply(previewWaypoints);
    }
  }, [previewWaypoints, onApply]);

  /**
   * Toggle drawing mode
   * TASK-132: Polygon drawing
   */
  const toggleDrawingMode = useCallback(() => {
    onModeChange(mode === "drawing" ? "idle" : "drawing");
  }, [mode, onModeChange]);

  /**
   * Toggle editing mode
   * TASK-133: Polygon editing
   */
  const toggleEditingMode = useCallback(() => {
    onModeChange(mode === "editing" ? "idle" : "editing");
  }, [mode, onModeChange]);

  /**
   * Toggle start point selection mode
   * TASK-134: Start point selection
   */
  const toggleStartPointMode = useCallback(() => {
    onModeChange(mode === "setStart" ? "idle" : "setStart");
  }, [mode, onModeChange]);

  /**
   * Toggle end point selection mode
   * TASK-135: End point selection
   */
  const toggleEndPointMode = useCallback(() => {
    onModeChange(mode === "setEnd" ? "idle" : "setEnd");
  }, [mode, onModeChange]);

  // ---- Render Helpers ----

  const canGenerate = validation?.isValid && vertices.length >= 3;
  const areaValue = vertices.length >= 3 ? polygonArea({ vertices }) : 0;

  // ---- Render ----

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-blue-400" />
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

      <div className="p-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* Mode indicator */}
        {mode !== "idle" && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
            mode === "drawing" ? "bg-blue-900/50 text-blue-300" :
            mode === "editing" ? "bg-yellow-900/50 text-yellow-300" :
            mode === "setStart" ? "bg-green-900/50 text-green-300" :
            "bg-red-900/50 text-red-300"
          }`}>
            <Info className="w-4 h-4" />
            {mode === "drawing" && "Click on map to add polygon vertices"}
            {mode === "editing" && "Drag vertices to edit, click to select"}
            {mode === "setStart" && "Click on map to set start/takeoff point"}
            {mode === "setEnd" && "Click on map to set end/landing point"}
          </div>
        )}

        {/* Drawing Controls */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Polygon Area
          </label>
          <div className="flex flex-wrap gap-2">
            {/* TASK-132: Draw polygon button */}
            <button
              onClick={toggleDrawingMode}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                mode === "drawing"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
              }`}
            >
              <Pencil className="w-4 h-4" />
              {mode === "drawing" ? "Drawing..." : "Draw Polygon"}
            </button>

            {/* TASK-133: Edit polygon button */}
            <button
              onClick={toggleEditingMode}
              disabled={vertices.length === 0}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                mode === "editing"
                  ? "bg-yellow-600 text-white"
                  : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              <MapPin className="w-4 h-4" />
              {mode === "editing" ? "Editing..." : "Edit Vertices"}
            </button>

            {/* Clear button */}
            <button
              onClick={handleClear}
              disabled={vertices.length === 0 && !startPoint && !endPoint}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Clear
            </button>
          </div>

          {/* Polygon info */}
          {vertices.length > 0 && (
            <div className="text-xs text-zinc-400">
              {vertices.length} vertices | Area: {vertices.length >= 3 ? formatArea(areaValue) : "—"}
            </div>
          )}
        </div>

        {/* TASK-133: Vertices List */}
        {vertices.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Vertices ({vertices.length})
            </label>
            <div className="max-h-32 overflow-y-auto space-y-1 bg-zinc-800 rounded p-2">
              {vertices.map((v, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-2 py-1 rounded text-xs ${
                    selectedVertexIdx === idx
                      ? "bg-blue-900/50 border border-blue-500"
                      : "hover:bg-zinc-700"
                  }`}
                >
                  <span className="text-zinc-300">
                    <span className="text-zinc-500 font-mono mr-2">{idx + 1}</span>
                    {v.lat.toFixed(6)}, {v.lng.toFixed(6)}
                  </span>
                  <button
                    onClick={() => handleDeleteVertex(idx)}
                    className="p-1 rounded hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Delete vertex"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Start/End Points */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Takeoff & Landing Points
          </label>
          <div className="flex flex-wrap gap-2">
            {/* TASK-134: Start point button */}
            <button
              onClick={toggleStartPointMode}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                mode === "setStart"
                  ? "bg-green-600 text-white"
                  : startPoint
                  ? "bg-green-900/50 text-green-300 border border-green-600"
                  : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
              }`}
            >
              <Target className="w-4 h-4" />
              {startPoint ? "Start Set ✓" : "Set Start"}
            </button>

            {/* TASK-135: End point button */}
            <button
              onClick={toggleEndPointMode}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                mode === "setEnd"
                  ? "bg-red-600 text-white"
                  : endPoint
                  ? "bg-red-900/50 text-red-300 border border-red-600"
                  : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
              }`}
            >
              <Flag className="w-4 h-4" />
              {endPoint ? "End Set ✓" : "Set End"}
            </button>
          </div>

          {/* Show coordinates if set */}
          {(startPoint || endPoint) && (
            <div className="text-xs text-zinc-400 space-y-1">
              {startPoint && (
                <div className="flex items-center gap-2">
                  <Target className="w-3 h-3 text-green-400" />
                  Start: {startPoint.lat.toFixed(6)}, {startPoint.lng.toFixed(6)}
                  <button
                    onClick={() => setStartPoint(null)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {endPoint && (
                <div className="flex items-center gap-2">
                  <Flag className="w-3 h-3 text-red-400" />
                  End: {endPoint.lat.toFixed(6)}, {endPoint.lng.toFixed(6)}
                  <button
                    onClick={() => setEndPoint(null)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SCAN Parameters */}
        <div className="space-y-3 pt-2 border-t border-zinc-700">
          {/* TASK-136: Altitude input */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">
              Altitude
              <span className="text-xs text-zinc-500 ml-2">(meters)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={200}
                value={altitude}
                onChange={(e) => setAltitude(Math.max(0, Math.min(200, Number(e.target.value))))}
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-zinc-400 w-8">m</span>
            </div>
          </div>

          {/* TASK-137: Spacing input */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">
              Line Spacing
              <span className="text-xs text-zinc-500 ml-2">(meters between scan lines)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                value={spacing}
                onChange={(e) => setSpacing(Math.max(1, Math.min(1000, Number(e.target.value))))}
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-zinc-400 w-8">m</span>
            </div>
          </div>

          {/* TASK-138: Angle input */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">
              Scan Angle
              <span className="text-xs text-zinc-500 ml-2">(0° = North, 90° = East)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
              <input
                type="number"
                min={0}
                max={360}
                value={angle}
                onChange={(e) => setAngle(normalizeAngle(Number(e.target.value)))}
                className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-zinc-400 w-4">°</span>
            </div>
            
            {/* TASK-139: Angle visual indicator */}
            <div className="flex items-center justify-center mt-2">
              <div className="relative w-16 h-16 border-2 border-zinc-600 rounded-full">
                {/* Compass background */}
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500">N</span>
                <span className="absolute top-1/2 -right-3 -translate-y-1/2 text-[10px] text-zinc-500">E</span>
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500">S</span>
                <span className="absolute top-1/2 -left-3 -translate-y-1/2 text-[10px] text-zinc-500">W</span>
                
                {/* Angle indicator line */}
                <div
                  className="absolute top-1/2 left-1/2 w-0.5 h-6 bg-blue-500 origin-bottom"
                  style={{
                    transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                  }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rotate-45" />
                </div>
                
                {/* Center dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-zinc-400 rounded-full" />
              </div>
            </div>
          </div>

          {/* Advanced options */}
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
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-zinc-400 w-8">m/s</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Validation Messages */}
        {validation && (
          <div className="space-y-2">
            {validation.errors.length > 0 && (
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
            {validation.warnings.length > 0 && (
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
          </div>
        )}

        {/* Statistics Preview */}
        {statistics && (
          <div className="bg-zinc-800 border border-zinc-700 rounded p-3 space-y-2">
            <div className="text-sm font-medium text-zinc-200">Pattern Preview</div>
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

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-700 bg-zinc-800/50">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded text-sm font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!canGenerate}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="w-4 h-4" />
          Apply Pattern
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS FOR MAP INTEGRATION
// ============================================================================

export {
  type Point,
  type ScanWaypoint,
};
