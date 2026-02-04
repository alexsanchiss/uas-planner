'use client';

/**
 * U-Plan Form Modal Component
 * 
 * Allows users to review and edit U-Plan data before submitting to FAS for authorization.
 * Implements comprehensive validation using Zod schemas from uplan-validator.ts.
 * 
 * Features:
 * - Collapsible sections for each field group
 * - Real-time validation with error display
 * - Save Draft (partial validation) 
 * - Send to FAS (full validation required)
 * - Read-only display of auto-generated fields (locations, operation volumes)
 * 
 * @implements TASK-012 through TASK-022
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { LoadingSpinner } from '../ui/loading-spinner';
import { useToast } from '@/app/hooks/useToast';
import {
  validateUplanFormData,
  validateUplanPartial,
  mergeWithDefaults,
  createEmptyUplanFormData,
  UplanDropdownOptions,
  type UplanFormDataPartial,
  type UplanValidationErrors,
  type FlightMode,
  type FlightCategory,
  type SpecialOperation,
  type Connectivity,
  type IdTechnology,
  type UasType,
  type UasClass,
  type UasDimension,
} from '@/lib/validators/uplan-validator';

// ============================================================================
// Types
// ============================================================================

interface UplanFormModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Flight plan ID for API calls */
  planId: string;
  /** Existing U-Plan data (may be partial) */
  existingUplan: unknown;
  /** Flight plan name for display */
  planName: string;
  /** Callback after successful save */
  onSave?: () => void;
  /** Callback after successful FAS submission */
  onSubmitToFAS?: () => void;
  /** Auth token for API calls */
  authToken: string;
  /** Whether the plan has been processed (has CSV result) */
  hasBeenProcessed: boolean;
  /** Whether the plan has scheduledAt set */
  hasScheduledAt: boolean;
}

interface CollapsibleSectionProps {
  title: string;
  required?: boolean;
  defaultOpen?: boolean;
  hasErrors?: boolean;
  children: React.ReactNode;
}

// ============================================================================
// Collapsible Section Component
// ============================================================================

function CollapsibleSection({ 
  title, 
  required = false, 
  defaultOpen = true,
  hasErrors = false,
  children 
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-600 rounded-md mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 flex items-center justify-between text-left font-semibold rounded-t-md transition-colors ${
          hasErrors 
            ? 'bg-red-900/30 text-red-300' 
            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
        }`}
      >
        <span>
          {isOpen ? '▼' : '▶'} {title}
          {required && <span className="text-red-400 ml-1">*</span>}
          {hasErrors && <span className="text-red-400 ml-2 text-sm">(has errors)</span>}
        </span>
      </button>
      {isOpen && (
        <div className="p-4 bg-gray-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Form Field Components
// ============================================================================

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string[];
  children: React.ReactNode;
}

function FormField({ label, required, error, children }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {error && error.length > 0 && (
        <p className="mt-1 text-sm text-red-400">{error.join(', ')}</p>
      )}
    </div>
  );
}

interface SelectFieldProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function SelectField({ value, onChange, options, placeholder = 'Select...', disabled = false, className = '' }: SelectFieldProps) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ============================================================================
// Dynamic Phone/Email Array Component
// ============================================================================

interface DynamicArrayFieldProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  type?: 'text' | 'email' | 'tel';
  required?: boolean;
  errors?: string[];
}

function DynamicArrayField({ 
  label, 
  values, 
  onChange, 
  placeholder, 
  type = 'text',
  required = false,
  errors 
}: DynamicArrayFieldProps) {
  const addItem = () => {
    onChange([...values, '']);
  };

  const removeItem = (index: number) => {
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues.length > 0 ? newValues : ['']);
  };

  const updateItem = (index: number, value: string) => {
    const newValues = [...values];
    newValues[index] = value;
    onChange(newValues);
  };

  // Ensure at least one empty field
  const displayValues = values.length > 0 ? values : [''];

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <div className="space-y-2">
        {displayValues.map((value, index) => (
          <div key={index} className="flex gap-2">
            <Input
              type={type}
              value={value}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
            {displayValues.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => removeItem(index)}
                className="px-3 text-red-400 hover:text-red-300"
              >
                ×
              </Button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-2 text-sm text-blue-400 hover:text-blue-300"
      >
        + Add {label.toLowerCase().replace(/s$/, '')}
      </button>
      {errors && errors.length > 0 && (
        <p className="mt-1 text-sm text-red-400">{errors.join(', ')}</p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function UplanFormModal({
  open,
  onClose,
  planId,
  existingUplan,
  planName,
  onSave,
  onSubmitToFAS,
  authToken,
  hasBeenProcessed,
  hasScheduledAt,
}: UplanFormModalProps) {
  const toast = useToast();

  // Form state
  const [formData, setFormData] = useState<UplanFormDataPartial>(createEmptyUplanFormData());
  const [validationErrors, setValidationErrors] = useState<UplanValidationErrors | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Initialize form data when modal opens or existingUplan changes
  useEffect(() => {
    if (open) {
      const merged = mergeWithDefaults(existingUplan);
      setFormData(merged);
      setValidationErrors(null);
    }
  }, [open, existingUplan]);

  // Helper to get field error
  const getFieldError = useCallback((path: string): string[] | undefined => {
    if (!validationErrors) return undefined;
    return validationErrors.fieldErrors[path];
  }, [validationErrors]);

  // Helper to get nested error
  const getNestedError = useCallback((section: string, field: string): string[] | undefined => {
    if (!validationErrors?.nestedErrors) return undefined;
    const sectionErrors = validationErrors.nestedErrors[section as keyof typeof validationErrors.nestedErrors];
    if (!sectionErrors) return undefined;
    if (typeof sectionErrors === 'object') {
      return (sectionErrors as Record<string, string[]>)[field];
    }
    return undefined;
  }, [validationErrors]);

  // Helper to check if section has errors
  const sectionHasErrors = useCallback((sectionPrefix: string): boolean => {
    if (!validationErrors) return false;
    return Object.keys(validationErrors.fieldErrors).some(key => key.startsWith(sectionPrefix));
  }, [validationErrors]);

  // Update nested form field
  const updateField = useCallback((path: string, value: unknown) => {
    setFormData(prev => {
      const parts = path.split('.');
      const newData = JSON.parse(JSON.stringify(prev)); // Deep clone
      let current: Record<string, unknown> = newData;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]] as Record<string, unknown>;
      }
      
      current[parts[parts.length - 1]] = value;
      return newData;
    });
  }, []);

  // Save draft (partial validation)
  // TASK-090: Merge form data with existing U-Plan to preserve auto-generated fields
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    
    // Validate partially
    const result = validateUplanPartial(formData);
    if (!result.success) {
      setValidationErrors(result.errors || null);
    }

    try {
      // Merge form data with existing U-Plan to preserve auto-generated fields
      // (operationVolumes, takeoffLocation, landingLocation, gcsLocation, etc.)
      const existingData = (typeof existingUplan === 'object' && existingUplan !== null) 
        ? existingUplan as Record<string, unknown>
        : {};
      
      const mergedUplan = {
        ...existingData, // Preserve auto-generated fields
        ...formData,     // Overwrite with user edits
      };

      const response = await fetch(`/api/flightPlans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          uplan: mergedUplan,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      toast.success('Draft saved successfully');
      onSave?.();
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Send to FAS (full validation required)
  // TASK-090: Merge form data with existing U-Plan to preserve auto-generated fields
  const handleSubmitToFAS = async () => {
    // Clear previous errors
    setValidationErrors(null);

    // Validate fully
    const result = validateUplanFormData(formData);
    if (!result.success) {
      setValidationErrors(result.errors || null);
      toast.error('Please fill all required fields before submitting');
      return;
    }

    // Check prerequisites
    if (!hasScheduledAt) {
      toast.error('Please set a scheduled date/time before submitting to FAS');
      return;
    }

    if (!hasBeenProcessed) {
      toast.error('Please process the flight plan before submitting to FAS');
      return;
    }

    setIsSubmitting(true);

    try {
      // Merge form data with existing U-Plan to preserve auto-generated fields
      // (operationVolumes, takeoffLocation, landingLocation, gcsLocation, etc.)
      const existingData = (typeof existingUplan === 'object' && existingUplan !== null) 
        ? existingUplan as Record<string, unknown>
        : {};
      
      const mergedUplan = {
        ...existingData, // Preserve auto-generated fields
        ...formData,     // Overwrite with user edits
      };

      // First, save the form data (merged with existing)
      const saveResponse = await fetch(`/api/flightPlans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          uplan: mergedUplan,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save U-Plan data');
      }

      // Then submit to FAS
      const fasResponse = await fetch(`/api/flightPlans/${planId}/uplan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!fasResponse.ok) {
        const errorData = await fasResponse.json();
        throw new Error(errorData.error || 'FAS submission failed');
      }

      toast.success('U-Plan submitted to FAS for authorization');
      onSubmitToFAS?.();
      onClose();
    } catch (error) {
      console.error('Error submitting to FAS:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit to FAS');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Extract location display values from existing uplan
  const existingUplanObj = typeof existingUplan === 'object' && existingUplan !== null 
    ? existingUplan as Record<string, unknown> 
    : {};
  
  const takeoffLocation = existingUplanObj.takeoffLocation as { coordinates?: number[] } | undefined;
  const landingLocation = existingUplanObj.landingLocation as { coordinates?: number[] } | undefined;
  const gcsLocation = existingUplanObj.gcsLocation as { coordinates?: number[] } | undefined;
  const operationVolumes = existingUplanObj.operationVolumes as unknown[] | undefined;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden relative flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            Review U-Plan: {planName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={(e) => { e.preventDefault(); }}>
            {/* Error Summary */}
            {validationErrors && Object.keys(validationErrors.fieldErrors).length > 0 && (
              <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-md">
                <h3 className="text-red-400 font-semibold mb-2">Validation Errors</h3>
                <p className="text-red-300 text-sm">
                  Please fill all required fields marked with * before submitting to FAS.
                </p>
              </div>
            )}

            {/* Data Identifiers Section */}
            <CollapsibleSection 
              title="Data Identifiers" 
              required 
              hasErrors={sectionHasErrors('dataOwnerIdentifier') || sectionHasErrors('dataSourceIdentifier')}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Owner</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField 
                      label="SAC" 
                      required 
                      error={getNestedError('dataOwnerIdentifier', 'sac')}
                    >
                      <Input
                        value={formData.dataOwnerIdentifier?.sac || ''}
                        onChange={(e) => updateField('dataOwnerIdentifier.sac', e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="3 chars"
                        maxLength={3}
                      />
                    </FormField>
                    <FormField 
                      label="SIC" 
                      required 
                      error={getNestedError('dataOwnerIdentifier', 'sic')}
                    >
                      <Input
                        value={formData.dataOwnerIdentifier?.sic || ''}
                        onChange={(e) => updateField('dataOwnerIdentifier.sic', e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="3 chars"
                        maxLength={3}
                      />
                    </FormField>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Source</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField 
                      label="SAC" 
                      required 
                      error={getNestedError('dataSourceIdentifier', 'sac')}
                    >
                      <Input
                        value={formData.dataSourceIdentifier?.sac || ''}
                        onChange={(e) => updateField('dataSourceIdentifier.sac', e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="3 chars"
                        maxLength={3}
                      />
                    </FormField>
                    <FormField 
                      label="SIC" 
                      required 
                      error={getNestedError('dataSourceIdentifier', 'sic')}
                    >
                      <Input
                        value={formData.dataSourceIdentifier?.sic || ''}
                        onChange={(e) => updateField('dataSourceIdentifier.sic', e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="3 chars"
                        maxLength={3}
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Contact Details Section */}
            <CollapsibleSection 
              title="Contact Details" 
              required 
              hasErrors={sectionHasErrors('contactDetails')}
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  label="First Name" 
                  required 
                  error={getNestedError('contactDetails', 'firstName')}
                >
                  <Input
                    value={formData.contactDetails?.firstName || ''}
                    onChange={(e) => updateField('contactDetails.firstName', e.target.value)}
                    placeholder="Enter first name"
                  />
                </FormField>
                <FormField 
                  label="Last Name" 
                  required 
                  error={getNestedError('contactDetails', 'lastName')}
                >
                  <Input
                    value={formData.contactDetails?.lastName || ''}
                    onChange={(e) => updateField('contactDetails.lastName', e.target.value)}
                    placeholder="Enter last name"
                  />
                </FormField>
              </div>
              <DynamicArrayField
                label="Phone Numbers"
                values={Array.isArray(formData.contactDetails?.phones) 
                  ? formData.contactDetails.phones 
                  : typeof formData.contactDetails?.phones === 'string' 
                    ? [formData.contactDetails.phones] 
                    : ['']}
                onChange={(values) => updateField('contactDetails.phones', values)}
                placeholder="+34..."
                type="tel"
                required
                errors={getNestedError('contactDetails', 'phones')}
              />
              <DynamicArrayField
                label="Email Addresses"
                values={Array.isArray(formData.contactDetails?.emails) 
                  ? formData.contactDetails.emails 
                  : typeof formData.contactDetails?.emails === 'string' 
                    ? [formData.contactDetails.emails] 
                    : ['']}
                onChange={(values) => updateField('contactDetails.emails', values)}
                placeholder="email@example.com"
                type="email"
                required
                errors={getNestedError('contactDetails', 'emails')}
              />
            </CollapsibleSection>

            {/* Flight Details Section */}
            <CollapsibleSection 
              title="Flight Details" 
              required 
              hasErrors={sectionHasErrors('flightDetails')}
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  label="Flight Mode" 
                  required 
                  error={getNestedError('flightDetails', 'mode')}
                >
                  <SelectField
                    value={formData.flightDetails?.mode}
                    onChange={(v) => updateField('flightDetails.mode', v as FlightMode)}
                    options={UplanDropdownOptions.mode}
                    placeholder="Select mode..."
                  />
                </FormField>
                <FormField 
                  label="Category" 
                  required 
                  error={getNestedError('flightDetails', 'category')}
                >
                  <SelectField
                    value={formData.flightDetails?.category}
                    onChange={(v) => updateField('flightDetails.category', v as FlightCategory)}
                    options={UplanDropdownOptions.category}
                    placeholder="Select category..."
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  label="Special Operation" 
                  error={getNestedError('flightDetails', 'specialOperation')}
                >
                  <SelectField
                    value={formData.flightDetails?.specialOperation}
                    onChange={(v) => updateField('flightDetails.specialOperation', v as SpecialOperation)}
                    options={UplanDropdownOptions.specialOperation}
                    placeholder="None"
                  />
                </FormField>
                <FormField label="Private Flight">
                  <div className="flex items-center h-10">
                    <Checkbox
                      checked={formData.flightDetails?.privateFlight || false}
                      onCheckedChange={(checked) => updateField('flightDetails.privateFlight', checked)}
                    />
                    <span className="ml-2 text-gray-300">This is a private flight</span>
                  </div>
                </FormField>
              </div>
            </CollapsibleSection>

            {/* UAS Information Section */}
            <CollapsibleSection 
              title="UAS Information" 
              required 
              hasErrors={sectionHasErrors('uas')}
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  label="Registration Number" 
                  required 
                  error={getNestedError('uas', 'registrationNumber') || validationErrors?.nestedErrors?.uas?.root?.['registrationNumber']}
                >
                  <Input
                    value={formData.uas?.registrationNumber || ''}
                    onChange={(e) => updateField('uas.registrationNumber', e.target.value)}
                    placeholder="Enter registration number"
                  />
                </FormField>
                <FormField 
                  label="Serial Number" 
                  required 
                  error={getNestedError('uas', 'serialNumber') || validationErrors?.nestedErrors?.uas?.root?.['serialNumber']}
                >
                  <Input
                    value={formData.uas?.serialNumber || ''}
                    onChange={(e) => updateField('uas.serialNumber', e.target.value.slice(0, 20))}
                    placeholder="Max 20 characters"
                    maxLength={20}
                  />
                </FormField>
              </div>

              {/* Flight Characteristics Subsection */}
              <div className="mt-4 p-3 bg-gray-700/30 rounded-md">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Flight Characteristics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField 
                    label="MTOM (kg)" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.flightCharacteristics?.['uasMTOM']}
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.uas?.flightCharacteristics?.uasMTOM ?? ''}
                      onChange={(e) => updateField('uas.flightCharacteristics.uasMTOM', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="e.g., 2.5"
                    />
                  </FormField>
                  <FormField 
                    label="Max Speed (m/s)" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.flightCharacteristics?.['uasMaxSpeed']}
                  >
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.uas?.flightCharacteristics?.uasMaxSpeed ?? ''}
                      onChange={(e) => updateField('uas.flightCharacteristics.uasMaxSpeed', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="e.g., 15"
                    />
                  </FormField>
                  <FormField 
                    label="Connectivity" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.flightCharacteristics?.['Connectivity']}
                  >
                    <SelectField
                      value={formData.uas?.flightCharacteristics?.Connectivity}
                      onChange={(v) => updateField('uas.flightCharacteristics.Connectivity', v as Connectivity)}
                      options={UplanDropdownOptions.connectivity}
                      placeholder="Select..."
                    />
                  </FormField>
                  <FormField 
                    label="ID Technology" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.flightCharacteristics?.['idTechnology']}
                  >
                    <SelectField
                      value={formData.uas?.flightCharacteristics?.idTechnology}
                      onChange={(v) => updateField('uas.flightCharacteristics.idTechnology', v as IdTechnology)}
                      options={UplanDropdownOptions.idTechnology}
                      placeholder="Select..."
                    />
                  </FormField>
                  <FormField 
                    label="Max Flight Time (min)" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.flightCharacteristics?.['maxFlightTime']}
                  >
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={formData.uas?.flightCharacteristics?.maxFlightTime ?? ''}
                      onChange={(e) => updateField('uas.flightCharacteristics.maxFlightTime', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="e.g., 30"
                    />
                  </FormField>
                </div>
              </div>

              {/* General Characteristics Subsection */}
              <div className="mt-4 p-3 bg-gray-700/30 rounded-md">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">General Characteristics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField 
                    label="Brand" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['brand']}
                  >
                    <Input
                      value={formData.uas?.generalCharacteristics?.brand || ''}
                      onChange={(e) => updateField('uas.generalCharacteristics.brand', e.target.value)}
                      placeholder="e.g., DJI"
                    />
                  </FormField>
                  <FormField 
                    label="Model" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['model']}
                  >
                    <Input
                      value={formData.uas?.generalCharacteristics?.model || ''}
                      onChange={(e) => updateField('uas.generalCharacteristics.model', e.target.value)}
                      placeholder="e.g., Mavic 3"
                    />
                  </FormField>
                  <FormField 
                    label="Type Certificate" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['typeCertificate']}
                  >
                    <Input
                      value={formData.uas?.generalCharacteristics?.typeCertificate || ''}
                      onChange={(e) => updateField('uas.generalCharacteristics.typeCertificate', e.target.value)}
                      placeholder="Enter certificate"
                    />
                  </FormField>
                  <FormField 
                    label="UAS Type" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['uasType']}
                  >
                    <SelectField
                      value={formData.uas?.generalCharacteristics?.uasType}
                      onChange={(v) => updateField('uas.generalCharacteristics.uasType', v as UasType)}
                      options={UplanDropdownOptions.uasType}
                      placeholder="Select..."
                    />
                  </FormField>
                  <FormField 
                    label="UAS Class" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['uasClass']}
                  >
                    <SelectField
                      value={formData.uas?.generalCharacteristics?.uasClass}
                      onChange={(v) => updateField('uas.generalCharacteristics.uasClass', v as UasClass)}
                      options={UplanDropdownOptions.uasClass}
                      placeholder="Select..."
                    />
                  </FormField>
                  <FormField 
                    label="Dimension" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['uasDimension']}
                  >
                    <SelectField
                      value={formData.uas?.generalCharacteristics?.uasDimension}
                      onChange={(v) => updateField('uas.generalCharacteristics.uasDimension', v as UasDimension)}
                      options={UplanDropdownOptions.uasDimension}
                      placeholder="Select..."
                    />
                  </FormField>
                </div>
              </div>
            </CollapsibleSection>

            {/* Operator Section */}
            <CollapsibleSection 
              title="Operator" 
              required 
              hasErrors={sectionHasErrors('operatorId')}
            >
              <FormField 
                label="Operator ID" 
                required 
                error={getFieldError('operatorId')}
              >
                <Input
                  value={formData.operatorId || ''}
                  onChange={(e) => updateField('operatorId', e.target.value)}
                  placeholder="Enter operator ID"
                />
              </FormField>
            </CollapsibleSection>

            {/* Locations Section (Read-only) */}
            <CollapsibleSection title="Locations" defaultOpen={false}>
              <p className="text-sm text-gray-400 mb-3">
                These locations are auto-generated from the flight trajectory.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3 bg-gray-700/30 rounded">
                  <span className="text-sm font-medium text-gray-400">Takeoff: </span>
                  <span className="text-gray-300">
                    {takeoffLocation?.coordinates 
                      ? `[${takeoffLocation.coordinates[1]?.toFixed(6)}, ${takeoffLocation.coordinates[0]?.toFixed(6)}]`
                      : 'Not available'}
                  </span>
                </div>
                <div className="p-3 bg-gray-700/30 rounded">
                  <span className="text-sm font-medium text-gray-400">Landing: </span>
                  <span className="text-gray-300">
                    {landingLocation?.coordinates 
                      ? `[${landingLocation.coordinates[1]?.toFixed(6)}, ${landingLocation.coordinates[0]?.toFixed(6)}]`
                      : 'Not available'}
                  </span>
                </div>
                <div className="p-3 bg-gray-700/30 rounded">
                  <span className="text-sm font-medium text-gray-400">GCS: </span>
                  <span className="text-gray-300">
                    {gcsLocation?.coordinates 
                      ? `[${gcsLocation.coordinates[1]?.toFixed(6)}, ${gcsLocation.coordinates[0]?.toFixed(6)}]`
                      : 'Not available'}
                  </span>
                </div>
              </div>
            </CollapsibleSection>

            {/* Operation Volumes Section (Read-only) */}
            <CollapsibleSection title="Operation Volumes" defaultOpen={false}>
              <p className="text-sm text-gray-400 mb-3">
                Operation volumes are auto-generated from the flight trajectory.
              </p>
              <div className="p-3 bg-gray-700/30 rounded">
                <span className="text-gray-300">
                  {operationVolumes 
                    ? `${operationVolumes.length} volume${operationVolumes.length !== 1 ? 's' : ''} defined`
                    : 'No volumes generated yet. Process the plan first.'}
                </span>
              </div>
            </CollapsibleSection>

            {/* Required Fields Note */}
            <div className="mt-4 p-3 bg-gray-700/30 rounded border-l-4 border-blue-500">
              <p className="text-sm text-gray-300">
                <span className="text-red-400">*</span> Required fields must be filled before submitting to FAS for authorization.
              </p>
            </div>
          </form>
        </div>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between bg-gray-800/50">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting || isSavingDraft}>
            Cancel
          </Button>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleSaveDraft}
              disabled={isSubmitting || isSavingDraft}
            >
              {isSavingDraft ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save Draft'
              )}
            </Button>
            <Button
              onClick={handleSubmitToFAS}
              disabled={isSubmitting || isSavingDraft || !hasBeenProcessed || !hasScheduledAt}
              title={
                !hasBeenProcessed 
                  ? 'Process the plan first'
                  : !hasScheduledAt 
                    ? 'Set a scheduled date first'
                    : 'Submit to FAS for authorization'
              }
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Submitting...
                </>
              ) : (
                'Send to FAS ▸'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
