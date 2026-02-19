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

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  /** Callback to request authorization - parent will handle confirmation dialog */
  onRequestAuthorization?: (planId: string) => void;
  /** Auth token for API calls */
  authToken: string;
  /** Whether the plan has been processed (has CSV result) */
  hasBeenProcessed: boolean;
  /** Whether the plan has scheduledAt set */
  hasScheduledAt: boolean;
  /** TASK-003: Missing fields from validation (for highlighting) */
  missingFields?: string[];
  /** TASK-003: Field-level error messages from validation */
  fieldErrors?: { [fieldName: string]: string };
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
  /** TASK-003: Whether this field has a validation error (for red highlighting) */
  hasValidationError?: boolean;
}

function FormField({ label, required, error, children, hasValidationError }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label className={`block text-sm font-medium mb-1 flex items-center gap-1 ${
        hasValidationError ? 'text-red-400' : 'text-gray-300'
      }`}>
        {hasValidationError && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <div className={hasValidationError ? 'error-shake' : ''}>
        {children}
      </div>
      {error && error.length > 0 && (
        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293z" clipRule="evenodd" />
          </svg>
          {error.join(', ')}
        </p>
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
  /** TASK-003: Whether this field has a validation error (for red highlighting) */
  hasValidationError?: boolean;
}

function SelectField({ value, onChange, options, placeholder = 'Select...', disabled = false, className = '', hasValidationError }: SelectFieldProps) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full px-3 py-2 border rounded-md text-white focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-colors ${
        hasValidationError 
          ? 'bg-red-900/30 border-red-500 focus:ring-red-500' 
          : 'bg-gray-700 border-gray-600 focus:ring-blue-500'
      } ${className}`}
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
  onRequestAuthorization,
  authToken,
  hasBeenProcessed,
  hasScheduledAt,
  missingFields: _missingFields = [], // Prefixed with _ to indicate intentionally unused (used for validation info passed from parent)
  fieldErrors = {},
}: UplanFormModalProps) {
  const toast = useToast();

  // Form state
  const [formData, setFormData] = useState<UplanFormDataPartial>(createEmptyUplanFormData());
  const [validationErrors, setValidationErrors] = useState<UplanValidationErrors | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  
  // Track whether modal was previously open to detect open transitions
  const wasOpenRef = useRef(false);

  // TASK-003: Merge external fieldErrors (from parent) with internal validation errors
  const mergedFieldErrors = React.useMemo(() => {
    const merged = { ...fieldErrors };
    if (validationErrors) {
      Object.entries(validationErrors.fieldErrors).forEach(([path, messages]) => {
        merged[path] = messages.join(', ');
      });
    }
    return merged;
  }, [fieldErrors, validationErrors]);

  // Initialize form data ONLY when modal transitions from closed to open
  // This prevents form data from being reset when existingUplan reference changes
  // (e.g., due to polling refreshes while the modal is already open)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // Modal just opened - initialize form data
      const merged = mergeWithDefaults(existingUplan);
      setFormData(merged);
      
      // TASK-003: Show external validation errors on open (if any)
      if (Object.keys(fieldErrors).length > 0) {
        const errors: UplanValidationErrors = {
          formErrors: [],
          fieldErrors: {},
        };
        Object.entries(fieldErrors).forEach(([path, message]) => {
          errors.fieldErrors[path] = [message];
        });
        setValidationErrors(errors);
      } else {
        setValidationErrors(null);
      }

      // Pre-fill contact details from user profile if empty
      if (authToken) {
        fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${authToken}` },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((profile) => {
            if (!profile) return;
            setFormData((prev) => {
              const next = JSON.parse(JSON.stringify(prev));
              if (!next.contactDetails) next.contactDetails = {};
              if (!next.contactDetails.firstName && profile.firstName) {
                next.contactDetails.firstName = profile.firstName;
              }
              if (!next.contactDetails.lastName && profile.lastName) {
                next.contactDetails.lastName = profile.lastName;
              }
              const phones: string[] = Array.isArray(next.contactDetails.phones)
                ? next.contactDetails.phones
                : [''];
              if ((!phones[0] || phones[0] === '') && profile.phone) {
                phones[0] = profile.phone;
                next.contactDetails.phones = phones;
              }
              return next;
            });
          })
          .catch(() => {});
      }
    }
    wasOpenRef.current = open;
  }, [open, existingUplan, fieldErrors, authToken]);

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

  // TASK-003: Helper to check if a specific field path has validation error
  const hasFieldError = useCallback((fieldPath: string): boolean => {
    return !!mergedFieldErrors[fieldPath];
  }, [mergedFieldErrors]);

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

  // TASK-003: Save draft, generate volumes, and request authorization
  // This saves changes and generates volumes, then closes modal and delegates to parent for confirmation
  const handleSaveAndRequestAuthorization = async () => {
    setIsSavingDraft(true);
    
    try {
      // Step 1: Save the draft with user edits
      const existingData = (typeof existingUplan === 'object' && existingUplan !== null) 
        ? existingUplan as Record<string, unknown>
        : {};
      
      const mergedUplan = {
        ...existingData, // Preserve auto-generated fields
        ...formData,     // Overwrite with user edits
      };

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
        throw new Error('Failed to save draft');
      }

      toast.success('U-Plan data saved');
      
      setIsSavingDraft(false);

      // Step 2: Generate operation volumes from trajectory
      setIsSubmitting(true);
      try {
        toast.info('Generating operation volumes...');
        const volumeResponse = await fetch(`/api/flightPlans/${planId}/generate-volumes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!volumeResponse.ok) {
          throw new Error('Failed to generate volumes');
        }
        
        const volumeResult = await volumeResponse.json();
        // console.log('[UplanFormModal] Volume generation:', {
          // volumesGenerated: volumeResult.volumesGenerated,
          // randomDataGenerated: volumeResult.randomDataGenerated
        // });
        
        toast.success(`Operation volumes generated (${volumeResult.volumesGenerated} volumes)`);
        
        // Notify parent to refresh
        onSave?.();
        
        setIsSubmitting(false);
        
        // Step 3: Close modal and delegate to parent for authorization confirmation
        onClose();
        
        // Step 4: Trigger parent authorization flow (which will show confirmation dialog)
        if (onRequestAuthorization) {
          onRequestAuthorization(planId);
        }
      } catch (error) {
        console.error('[UplanFormModal] Volume generation error:', error);
        toast.error('Failed to generate volumes. Please try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
      setIsSavingDraft(false);
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
                      hasValidationError={hasFieldError('dataOwnerIdentifier.sac')}
                    >
                      <Input
                        value={formData.dataOwnerIdentifier?.sac || ''}
                        onChange={(e) => updateField('dataOwnerIdentifier.sac', e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="3 chars"
                        maxLength={3}
                        hasValidationError={hasFieldError('dataOwnerIdentifier.sac')}
                      />
                    </FormField>
                    <FormField 
                      label="SIC" 
                      required 
                      error={getNestedError('dataOwnerIdentifier', 'sic')}
                      hasValidationError={hasFieldError('dataOwnerIdentifier.sic')}
                    >
                      <Input
                        value={formData.dataOwnerIdentifier?.sic || ''}
                        onChange={(e) => updateField('dataOwnerIdentifier.sic', e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="3 chars"
                        maxLength={3}
                        hasValidationError={hasFieldError('dataOwnerIdentifier.sic')}
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
                      hasValidationError={hasFieldError('dataSourceIdentifier.sac')}
                    >
                      <Input
                        value={formData.dataSourceIdentifier?.sac || ''}
                        onChange={(e) => updateField('dataSourceIdentifier.sac', e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="3 chars"
                        maxLength={3}
                        hasValidationError={hasFieldError('dataSourceIdentifier.sac')}
                      />
                    </FormField>
                    <FormField 
                      label="SIC" 
                      required 
                      error={getNestedError('dataSourceIdentifier', 'sic')}
                      hasValidationError={hasFieldError('dataSourceIdentifier.sic')}
                    >
                      <Input
                        value={formData.dataSourceIdentifier?.sic || ''}
                        onChange={(e) => updateField('dataSourceIdentifier.sic', e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="3 chars"
                        maxLength={3}
                        hasValidationError={hasFieldError('dataSourceIdentifier.sic')}
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
                  hasValidationError={hasFieldError('contactDetails.firstName')}
                >
                  <Input
                    value={formData.contactDetails?.firstName || ''}
                    onChange={(e) => updateField('contactDetails.firstName', e.target.value)}
                    placeholder="Enter first name"
                    hasValidationError={hasFieldError('contactDetails.firstName')}
                  />
                </FormField>
                <FormField 
                  label="Last Name" 
                  required 
                  error={getNestedError('contactDetails', 'lastName')}
                  hasValidationError={hasFieldError('contactDetails.lastName')}
                >
                  <Input
                    value={formData.contactDetails?.lastName || ''}
                    onChange={(e) => updateField('contactDetails.lastName', e.target.value)}
                    placeholder="Enter last name"
                    hasValidationError={hasFieldError('contactDetails.lastName')}
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
                  hasValidationError={hasFieldError('flightDetails.mode')}
                >
                  <SelectField
                    value={formData.flightDetails?.mode}
                    onChange={(v) => updateField('flightDetails.mode', v as FlightMode)}
                    options={UplanDropdownOptions.mode}
                    placeholder="Select mode..."
                    hasValidationError={hasFieldError('flightDetails.mode')}
                  />
                </FormField>
                <FormField 
                  label="Category" 
                  required 
                  error={getNestedError('flightDetails', 'category')}
                  hasValidationError={hasFieldError('flightDetails.category')}
                >
                  <SelectField
                    value={formData.flightDetails?.category}
                    onChange={(v) => updateField('flightDetails.category', v as FlightCategory)}
                    options={UplanDropdownOptions.category}
                    placeholder="Select category..."
                    hasValidationError={hasFieldError('flightDetails.category')}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  label="Special Operation" 
                  error={getNestedError('flightDetails', 'specialOperation')}
                  hasValidationError={hasFieldError('flightDetails.specialOperation')}
                >
                  <SelectField
                    value={formData.flightDetails?.specialOperation}
                    onChange={(v) => updateField('flightDetails.specialOperation', v as SpecialOperation)}
                    options={UplanDropdownOptions.specialOperation}
                    placeholder="None"
                    hasValidationError={hasFieldError('flightDetails.specialOperation')}
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
                  hasValidationError={hasFieldError('uas.registrationNumber')}
                >
                  <Input
                    value={formData.uas?.registrationNumber || ''}
                    onChange={(e) => updateField('uas.registrationNumber', e.target.value)}
                    placeholder="Enter registration number"
                    hasValidationError={hasFieldError('uas.registrationNumber')}
                  />
                </FormField>
                <FormField 
                  label="Serial Number" 
                  required 
                  error={getNestedError('uas', 'serialNumber') || validationErrors?.nestedErrors?.uas?.root?.['serialNumber']}
                  hasValidationError={hasFieldError('uas.serialNumber')}
                >
                  <Input
                    value={formData.uas?.serialNumber || ''}
                    onChange={(e) => updateField('uas.serialNumber', e.target.value.slice(0, 20))}
                    placeholder="Max 20 characters"
                    maxLength={20}
                    hasValidationError={hasFieldError('uas.serialNumber')}
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
                    hasValidationError={hasFieldError('uas.flightCharacteristics.uasMTOM')}
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.uas?.flightCharacteristics?.uasMTOM ?? ''}
                      onChange={(e) => updateField('uas.flightCharacteristics.uasMTOM', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="e.g., 2.5"
                      hasValidationError={hasFieldError('uas.flightCharacteristics.uasMTOM')}
                    />
                  </FormField>
                  <FormField 
                    label="Max Speed (m/s)" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.flightCharacteristics?.['uasMaxSpeed']}
                    hasValidationError={hasFieldError('uas.flightCharacteristics.uasMaxSpeed')}
                  >
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.uas?.flightCharacteristics?.uasMaxSpeed ?? ''}
                      onChange={(e) => updateField('uas.flightCharacteristics.uasMaxSpeed', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="e.g., 15"
                      hasValidationError={hasFieldError('uas.flightCharacteristics.uasMaxSpeed')}
                    />
                  </FormField>
                  <FormField 
                    label="Connectivity" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.flightCharacteristics?.['Connectivity']}
                    hasValidationError={hasFieldError('uas.flightCharacteristics.Connectivity')}
                  >
                    <SelectField
                      value={formData.uas?.flightCharacteristics?.Connectivity}
                      onChange={(v) => updateField('uas.flightCharacteristics.Connectivity', v as Connectivity)}
                      options={UplanDropdownOptions.connectivity}
                      placeholder="Select..."
                      hasValidationError={hasFieldError('uas.flightCharacteristics.Connectivity')}
                    />
                  </FormField>
                  <FormField 
                    label="ID Technology" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.flightCharacteristics?.['idTechnology']}
                    hasValidationError={hasFieldError('uas.flightCharacteristics.idTechnology')}
                  >
                    <SelectField
                      value={formData.uas?.flightCharacteristics?.idTechnology}
                      onChange={(v) => updateField('uas.flightCharacteristics.idTechnology', v as IdTechnology)}
                      options={UplanDropdownOptions.idTechnology}
                      placeholder="Select..."
                      hasValidationError={hasFieldError('uas.flightCharacteristics.idTechnology')}
                    />
                  </FormField>
                  <FormField 
                    label="Max Flight Time (min)" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.flightCharacteristics?.['maxFlightTime']}
                    hasValidationError={hasFieldError('uas.flightCharacteristics.maxFlightTime')}
                  >
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={formData.uas?.flightCharacteristics?.maxFlightTime ?? ''}
                      onChange={(e) => updateField('uas.flightCharacteristics.maxFlightTime', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="e.g., 30"
                      hasValidationError={hasFieldError('uas.flightCharacteristics.maxFlightTime')}
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
                    hasValidationError={hasFieldError('uas.generalCharacteristics.brand')}
                  >
                    <Input
                      value={formData.uas?.generalCharacteristics?.brand || ''}
                      onChange={(e) => updateField('uas.generalCharacteristics.brand', e.target.value)}
                      placeholder="e.g., DJI"
                      hasValidationError={hasFieldError('uas.generalCharacteristics.brand')}
                    />
                  </FormField>
                  <FormField 
                    label="Model" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['model']}
                    hasValidationError={hasFieldError('uas.generalCharacteristics.model')}
                  >
                    <Input
                      value={formData.uas?.generalCharacteristics?.model || ''}
                      onChange={(e) => updateField('uas.generalCharacteristics.model', e.target.value)}
                      placeholder="e.g., Mavic 3"
                      hasValidationError={hasFieldError('uas.generalCharacteristics.model')}
                    />
                  </FormField>
                  <FormField 
                    label="Type Certificate" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['typeCertificate']}
                    hasValidationError={hasFieldError('uas.generalCharacteristics.typeCertificate')}
                  >
                    <Input
                      value={formData.uas?.generalCharacteristics?.typeCertificate || ''}
                      onChange={(e) => updateField('uas.generalCharacteristics.typeCertificate', e.target.value)}
                      placeholder="Enter certificate"
                      hasValidationError={hasFieldError('uas.generalCharacteristics.typeCertificate')}
                    />
                  </FormField>
                  <FormField 
                    label="UAS Type" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['uasType']}
                    hasValidationError={hasFieldError('uas.generalCharacteristics.uasType')}
                  >
                    <SelectField
                      value={formData.uas?.generalCharacteristics?.uasType}
                      onChange={(v) => updateField('uas.generalCharacteristics.uasType', v as UasType)}
                      options={UplanDropdownOptions.uasType}
                      placeholder="Select..."
                      hasValidationError={hasFieldError('uas.generalCharacteristics.uasType')}
                    />
                  </FormField>
                  <FormField 
                    label="UAS Class" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['uasClass']}
                    hasValidationError={hasFieldError('uas.generalCharacteristics.uasClass')}
                  >
                    <SelectField
                      value={formData.uas?.generalCharacteristics?.uasClass}
                      onChange={(v) => updateField('uas.generalCharacteristics.uasClass', v as UasClass)}
                      options={UplanDropdownOptions.uasClass}
                      placeholder="Select..."
                      hasValidationError={hasFieldError('uas.generalCharacteristics.uasClass')}
                    />
                  </FormField>
                  <FormField 
                    label="Dimension" 
                    required 
                    error={validationErrors?.nestedErrors?.uas?.generalCharacteristics?.['uasDimension']}
                    hasValidationError={hasFieldError('uas.generalCharacteristics.uasDimension')}
                  >
                    <SelectField
                      value={formData.uas?.generalCharacteristics?.uasDimension}
                      onChange={(v) => updateField('uas.generalCharacteristics.uasDimension', v as UasDimension)}
                      options={UplanDropdownOptions.uasDimension}
                      placeholder="Select..."
                      hasValidationError={hasFieldError('uas.generalCharacteristics.uasDimension')}
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
                hasValidationError={hasFieldError('operatorId')}
              >
                <Input
                  value={formData.operatorId || ''}
                  onChange={(e) => updateField('operatorId', e.target.value)}
                  placeholder="Enter operator ID"
                  hasValidationError={hasFieldError('operatorId')}
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
        {/* TASK-003: Added "Save & Request Authorization" button for iterative workflow */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between bg-gray-800/50">
          <Button variant="outline" onClick={onClose} disabled={isSavingDraft || isSubmitting}>
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isSubmitting}
              variant="outline"
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
              onClick={handleSaveAndRequestAuthorization}
              disabled={isSavingDraft || isSubmitting || !hasScheduledAt || !hasBeenProcessed}
              title={!hasScheduledAt ? 'Please set a scheduled date/time first' : !hasBeenProcessed ? 'Please process the flight plan first' : undefined}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Save & Request Auth
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
