"use client";

// Waypoint list of the Plan Definition planner: drag and drop (with a grip handle), keyboard-friendly
// move up/down buttons, labelled fields per waypoint and the "add by coordinates" form.
// All plan logic (type rules, clamping, bounds) stays in PlanGenerator; this component only renders and reports.

import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";

export interface Waypoint {
  lat: number;
  lng: number;
  type: "takeoff" | "cruise" | "landing";
  altitude: number | string;
  speed: number | string;
  pauseDuration: number | string; // TASK-121: Hold time in seconds (0-3600)
  flyOverMode: boolean; // TASK-126: true = fly-over (pass directly over), false = fly-by (smooth curve)
}

export const waypointTypes = [
  { value: "takeoff", label: "Takeoff" },
  { value: "cruise", label: "Cruise" },
  { value: "landing", label: "Landing" },
];

interface WaypointListProps {
  waypoints: Waypoint[];
  selectedIdx: number | null;
  onChange: (idx: number, field: keyof Waypoint, value: number | string | boolean) => void;
  onRemove: (idx: number) => void;
  onMove: (from: number, to: number) => void;
  /** Adds a waypoint at the typed coordinates. Returns false (after reporting why) when it was rejected. */
  onAddAt: (lat: number, lng: number) => boolean;
  /** Pre-fill of the add form when the plan has no waypoints yet. */
  center: [number, number];
}

function NumberField({
  id,
  label,
  value,
  onChange,
  disabled,
  min = 0,
  max,
  title,
}: {
  id: string;
  label: string;
  value: number | string;
  onChange: (value: number | "") => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  title?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted" title={title}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="input px-2 py-1 text-xs"
        disabled={disabled}
      />
    </div>
  );
}

function CoordField({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        key={`${id}-${Number(value).toFixed(7)}`}
        type="text"
        inputMode="decimal"
        defaultValue={Number(value).toFixed(7)}
        onBlur={(e) => {
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            onCommit(val);
          } else {
            e.target.value = Number(value).toFixed(7);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="input px-2 py-1 text-xs"
      />
    </div>
  );
}

const iconButton =
  "grid h-8 w-8 place-items-center rounded-md text-fg-2 hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

export default function WaypointList({
  waypoints,
  selectedIdx,
  onChange,
  onRemove,
  onMove,
  onAddAt,
  center,
}: WaypointListProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [addLat, setAddLat] = useState("");
  const [addLng, setAddLng] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const last = waypoints.length - 1;

  const move = (from: number, to: number) => {
    if (to < 0 || to > last) return;
    onMove(from, to);
    setAnnouncement(`Waypoint ${from + 1} moved to position ${to + 1} of ${waypoints.length}.`);
    // The row that now holds the moved waypoint keeps keyboard focus on the same kind of button.
    const dir = to < from ? "up" : "down";
    const stillCan = dir === "up" ? to > 0 : to < last;
    setTimeout(() => document.getElementById(`wp-${to}-${stillCan ? dir : dir === "up" ? "down" : "up"}`)?.focus(), 0);
  };

  const openAddForm = () => {
    // Pre-fill with last waypoint's coords or map center
    const ref = waypoints.length > 0 ? waypoints[last] : null;
    setAddLat((ref ? ref.lat : center[0]).toFixed(7));
    setAddLng((ref ? ref.lng : center[1]).toFixed(7));
    setAddOpen(true);
  };

  return (
    <div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {waypoints.length === 0 && (
        <p className="mb-2 text-sm text-muted">Click on the map or use Add waypoint to create the first waypoint.</p>
      )}
      <DragDropContext
        onDragEnd={(result: DropResult) => {
          if (!result.destination) return;
          onMove(result.source.index, result.destination.index);
        }}
      >
        <Droppable droppableId="waypoints-droppable">
          {(provided) => (
            <ul className="space-y-2" {...provided.droppableProps} ref={provided.innerRef}>
              {waypoints.map((wp, idx) => {
                const n = idx + 1;
                return (
                  <Draggable key={idx} draggableId={String(idx)} index={idx}>
                    {(dragProvided, dragSnapshot) => (
                      <li
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        aria-current={selectedIdx === idx ? "true" : undefined}
                        className={`rounded-md border p-2 ${
                          selectedIdx === idx ? "border-brand-ring bg-info-soft" : "border-line bg-canvas"
                        } ${dragSnapshot.isDragging ? "ring-2 ring-brand-ring" : ""}`}
                      >
                        <div className="flex items-center gap-1">
                          <div
                            {...dragProvided.dragHandleProps}
                            aria-label={`Drag to reorder waypoint ${n}`}
                            className="grid h-8 w-6 cursor-grab place-items-center rounded text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                          >
                            <GripVertical className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <span className="w-5 text-center font-mono text-xs text-muted">{n}</span>
                          <label htmlFor={`wp-${idx}-type`} className="sr-only">
                            Waypoint {n} type
                          </label>
                          <select
                            id={`wp-${idx}-type`}
                            value={wp.type}
                            onChange={(e) => onChange(idx, "type", e.target.value)}
                            className="input select min-w-0 flex-1 px-2 py-1 text-xs"
                          >
                            {waypointTypes.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <button
                            id={`wp-${idx}-up`}
                            type="button"
                            className={iconButton}
                            onClick={() => move(idx, idx - 1)}
                            disabled={idx === 0}
                            aria-label={`Move waypoint ${n} up`}
                            title="Move up"
                          >
                            <ChevronUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            id={`wp-${idx}-down`}
                            type="button"
                            className={iconButton}
                            onClick={() => move(idx, idx + 1)}
                            disabled={idx === last}
                            aria-label={`Move waypoint ${n} down`}
                            title="Move down"
                          >
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={`${iconButton} text-danger-text hover:text-danger-text`}
                            onClick={() => onRemove(idx)}
                            aria-label={`Remove waypoint ${n}`}
                            title="Remove waypoint"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <NumberField
                            id={`wp-${idx}-alt`}
                            label="Altitude (m)"
                            value={wp.altitude}
                            onChange={(v) => onChange(idx, "altitude", v)}
                            disabled={wp.type === "landing"}
                          />
                          <NumberField
                            id={`wp-${idx}-speed`}
                            label="Speed (m/s)"
                            value={wp.speed}
                            onChange={(v) => onChange(idx, "speed", v)}
                          />
                          {/* TASK-122: Pause duration input */}
                          <NumberField
                            id={`wp-${idx}-pause`}
                            label="Pause (s)"
                            title="Hold time at waypoint (0-3600 seconds)"
                            value={wp.pauseDuration}
                            max={3600}
                            onChange={(v) => onChange(idx, "pauseDuration", v)}
                          />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <CoordField
                            id={`wp-${idx}-lat`}
                            label="Latitude"
                            value={wp.lat}
                            onCommit={(v) => onChange(idx, "lat", v)}
                          />
                          <CoordField
                            id={`wp-${idx}-lng`}
                            label="Longitude"
                            value={wp.lng}
                            onCommit={(v) => onChange(idx, "lng", v)}
                          />
                        </div>
                        {/* TASK-127 & TASK-130: Fly-by/Fly-over toggle */}
                        {wp.type === "cruise" && (
                          <label
                            className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-fg-2"
                            title="Fly-by: drone smoothly curves past the waypoint. Fly-over: drone must pass directly over the waypoint (more precise but slower)."
                          >
                            <input
                              type="checkbox"
                              checked={wp.flyOverMode || false}
                              onChange={(e) => onChange(idx, "flyOverMode", e.target.checked)}
                              className="h-4 w-4 accent-[var(--color-accent)]"
                            />
                            <span className="font-medium">Fly-over</span>
                            <span className="text-muted">{wp.flyOverMode ? "(pass directly over)" : "(off: fly-by, smooth curve)"}</span>
                          </label>
                        )}
                      </li>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Waypoint Button and Inline Form */}
      <div className="mt-3">
        {!addOpen ? (
          <button
            type="button"
            onClick={openAddForm}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line-2 px-3 py-2 text-sm font-medium text-fg-2 transition-colors hover:border-brand-ring hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Waypoint
          </button>
        ) : (
          <form
            className="space-y-2 rounded-md border border-line bg-canvas p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (onAddAt(parseFloat(addLat), parseFloat(addLng))) setAddOpen(false);
            }}
          >
            <div className="text-xs font-semibold text-fg-2">New Waypoint</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="add-wp-lat" className="mb-1 block text-xs text-muted">
                  Latitude
                </label>
                <input
                  id="add-wp-lat"
                  type="text"
                  inputMode="decimal"
                  value={addLat}
                  onChange={(e) => setAddLat(e.target.value)}
                  className="input px-2 py-1 text-xs"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="add-wp-lng" className="mb-1 block text-xs text-muted">
                  Longitude
                </label>
                <input
                  id="add-wp-lng"
                  type="text"
                  inputMode="decimal"
                  value={addLng}
                  onChange={(e) => setAddLng(e.target.value)}
                  className="input px-2 py-1 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn btn-primary flex-1 px-3 py-1.5 text-xs">
                Add
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="btn flex-1 border border-line-2 px-3 py-1.5 text-xs text-fg-2 hover:bg-hover"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
