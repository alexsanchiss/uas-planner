"use client";

import React, { useState } from "react";
import { Modal } from "@/app/components/ui/modal";
import { Input } from "@/app/components/ui/input";
import type { USpace } from "@/app/hooks/useUspaces";

interface CustomAreaModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the square U-space built from the form (the caller selects it and closes the dialog). */
  onCreate: (uspace: USpace) => void;
}

type Errors = Partial<Record<"id" | "name" | "latMin" | "latMax" | "lonMin" | "lonMax", string>>;

/** "Define a Custom Area" dialog: labelled fields with an inline `role="alert"` error under each one. */
export default function CustomAreaModal({ open, onClose, onCreate }: CustomAreaModalProps) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [latMin, setLatMin] = useState("");
  const [latMax, setLatMax] = useState("");
  const [lonMin, setLonMin] = useState("");
  const [lonMax, setLonMax] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const close = () => {
    setErrors({});
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const latMinNum = parseFloat(latMin);
    const latMaxNum = parseFloat(latMax);
    const lonMinNum = parseFloat(lonMin);
    const lonMaxNum = parseFloat(lonMax);
    const next: Errors = {};
    if (!id.trim()) next.id = "Area ID is required.";
    if (!name.trim()) next.name = "Area name is required.";
    if (isNaN(latMinNum)) next.latMin = "Enter a number.";
    if (isNaN(latMaxNum)) next.latMax = "Enter a number.";
    if (isNaN(lonMinNum)) next.lonMin = "Enter a number.";
    if (isNaN(lonMaxNum)) next.lonMax = "Enter a number.";
    if (!next.latMin && !next.latMax && latMinNum >= latMaxNum) next.latMax = "Max latitude must be greater than min.";
    if (!next.lonMin && !next.lonMax && lonMinNum >= lonMaxNum) next.lonMax = "Max longitude must be greater than min.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // Square boundary, closed ring
    onCreate({
      id: id.trim(),
      name: name.trim(),
      boundary: [
        { latitude: latMinNum, longitude: lonMinNum }, // SW
        { latitude: latMinNum, longitude: lonMaxNum }, // SE
        { latitude: latMaxNum, longitude: lonMaxNum }, // NE
        { latitude: latMaxNum, longitude: lonMinNum }, // NW
        { latitude: latMinNum, longitude: lonMinNum }, // Close
      ],
    });
    setErrors({});
  };

  return (
    // The app header sits at z-[9999], so the dialog must be above it.
    <Modal open={open} onClose={close} title="Define Custom Area" maxWidth="md" overlayZIndex="z-[10000]">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Area ID" type="text" value={id} onChange={(e) => setId(e.target.value)} error={errors.id} required />
          <Input label="Area Name" type="text" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg-2">Square area limits (degrees)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Latitude min" type="number" step="any" value={latMin} onChange={(e) => setLatMin(e.target.value)} error={errors.latMin} required />
            <Input label="Latitude max" type="number" step="any" value={latMax} onChange={(e) => setLatMax(e.target.value)} error={errors.latMax} required />
            <Input label="Longitude min" type="number" step="any" value={lonMin} onChange={(e) => setLonMin(e.target.value)} error={errors.lonMin} required />
            <Input label="Longitude max" type="number" step="any" value={lonMax} onChange={(e) => setLonMax(e.target.value)} error={errors.lonMax} required />
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={close} className="btn border border-line-2 text-fg-2 hover:bg-hover">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Area
          </button>
        </div>
      </form>
    </Modal>
  );
}
