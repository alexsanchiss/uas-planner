/**
 * U-Plan Validation Schemas with Zod
 * 
 * This module provides comprehensive validation for U-Plan objects based on
 * the official uplan_schema_UPV.json specification.
 * 
 * Features:
 * - Full validation for submission to FAS
 * - Partial validation for draft saving
 * - Type inference for TypeScript
 * - Structured error messages for UI display
 * 
 * @module lib/validators/uplan-validator
 */

import { z } from 'zod';

// ============================================================================
// Enum Definitions
// ============================================================================

export const FlightModeEnum = z.enum(['VLOS', 'BVLOS']);
export type FlightMode = z.infer<typeof FlightModeEnum>;

export const FlightCategoryEnum = z.enum([
  'OPENA1',
  'OPENA2',
  'OPENA3',
  'SAIL_I-II',
  'SAIL_III-IV',
  'SAIL_V-VI',
  'Certi_No_Pass',
  'Certi_Pass',
]);
export type FlightCategory = z.infer<typeof FlightCategoryEnum>;

export const SpecialOperationEnum = z.enum([
  '',
  'POLICE_AND_CUSTOMS',
  'TRAFFIC_SURVEILLANCE_AND_PURSUIT',
  'ENVIRONMENTAL_CONTROL',
  'SEARCH_AND_RESCUE',
  'MEDICAL',
  'EVACUATIONS',
  'FIREFIGHTING',
  'STATE_OFFICIALS',
]);
export type SpecialOperation = z.infer<typeof SpecialOperationEnum>;

export const ConnectivityEnum = z.enum(['RF', 'LTE', 'SAT', '5G']);
export type Connectivity = z.infer<typeof ConnectivityEnum>;

export const IdTechnologyEnum = z.enum(['NRID', 'ADSB', 'OTHER']);
export type IdTechnology = z.infer<typeof IdTechnologyEnum>;

export const UasTypeEnum = z.enum(['NONE_NOT_DECLARED', 'MULTIROTOR', 'FIXED_WING']);
export type UasType = z.infer<typeof UasTypeEnum>;

export const UasClassEnum = z.enum(['NONE', 'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6']);
export type UasClass = z.infer<typeof UasClassEnum>;

export const UasDimensionEnum = z.enum(['LT_1', 'LT_3', 'LT_8', 'GTE_8']);
export type UasDimension = z.infer<typeof UasDimensionEnum>;

export const StateEnum = z.enum([
  'SENT',
  'PROCESSING',
  'ACCEPTED',
  'ACTIVATED',
  'WITHDRAWN',
  'ENDED',
]);
export type State = z.infer<typeof StateEnum>;

export const AltitudeReferenceEnum = z.enum(['AGL']);
export type AltitudeReference = z.infer<typeof AltitudeReferenceEnum>;

export const AltitudeUomEnum = z.enum(['M', 'FT']);
export type AltitudeUom = z.infer<typeof AltitudeUomEnum>;

// ============================================================================
// Component Schemas (Full Validation)
// ============================================================================

/**
 * Data Owner/Source Identifier
 * SAC and SIC must be exactly 3 characters
 */
export const DataIdentifierSchema = z.object({
  sac: z.string().length(3, 'SAC must be exactly 3 characters'),
  sic: z.string().length(3, 'SIC must be exactly 3 characters'),
});
export type DataIdentifier = z.infer<typeof DataIdentifierSchema>;

/**
 * Contact Details
 * Phones and emails can be single string or array
 */
export const ContactDetailsSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phones: z.union([
    z.string().min(1, 'At least one phone number is required'),
    z.array(z.string()).min(1, 'At least one phone number is required'),
  ]),
  emails: z.union([
    z.string().email('Invalid email format'),
    z.array(z.string().email('Invalid email format')).min(1, 'At least one email is required'),
  ]),
});
export type ContactDetails = z.infer<typeof ContactDetailsSchema>;

/**
 * Flight Details
 */
export const FlightDetailsSchema = z.object({
  mode: FlightModeEnum,
  category: FlightCategoryEnum,
  specialOperation: SpecialOperationEnum,
  privateFlight: z.boolean(),
});
export type FlightDetails = z.infer<typeof FlightDetailsSchema>;

/**
 * Flight Characteristics
 */
export const FlightCharacteristicsSchema = z.object({
  uasMTOM: z.number().positive('MTOM must be a positive number'),
  uasMaxSpeed: z.number().positive('Max speed must be a positive number'),
  Connectivity: ConnectivityEnum,
  idTechnology: IdTechnologyEnum,
  maxFlightTime: z.number().positive('Max flight time must be a positive number'),
});
export type FlightCharacteristics = z.infer<typeof FlightCharacteristicsSchema>;

/**
 * General Characteristics
 */
export const GeneralCharacteristicsSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  typeCertificate: z.string().min(1, 'Type certificate is required'),
  uasType: UasTypeEnum,
  uasClass: UasClassEnum,
  uasDimension: UasDimensionEnum,
});
export type GeneralCharacteristics = z.infer<typeof GeneralCharacteristicsSchema>;

/**
 * UAS Information
 */
export const UASSchema = z.object({
  registrationNumber: z.string().min(1, 'Registration number is required'),
  serialNumber: z.string().min(1, 'Serial number is required').max(20, 'Serial number must be 20 characters or less'),
  flightCharacteristics: FlightCharacteristicsSchema,
  generalCharacteristics: GeneralCharacteristicsSchema,
});
export type UAS = z.infer<typeof UASSchema>;

/**
 * GeoJSON Point
 */
export const GeoJSONPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.array(z.number()).min(2).max(3),
  properties: z.object({
    altitude: z.number().optional(),
  }).optional(),
});
export type GeoJSONPoint = z.infer<typeof GeoJSONPointSchema>;

/**
 * GeoJSON Polygon
 */
export const GeoJSONPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.array(z.number()).min(2)).min(4)),
  bbox: z.array(z.number()).length(4),
});
export type GeoJSONPolygon = z.infer<typeof GeoJSONPolygonSchema>;

/**
 * Altitude
 */
export const AltitudeSchema = z.object({
  value: z.number(),
  reference: AltitudeReferenceEnum,
  uom: AltitudeUomEnum,
});
export type Altitude = z.infer<typeof AltitudeSchema>;

/**
 * Operation Volume
 */
export const OperationVolumeSchema = z.object({
  geometry: GeoJSONPolygonSchema,
  timeBegin: z.string().datetime(),
  timeEnd: z.string().datetime(),
  minAltitude: AltitudeSchema,
  maxAltitude: AltitudeSchema,
  ordinal: z.number().int().nonnegative(),
});
export type OperationVolume = z.infer<typeof OperationVolumeSchema>;

// ============================================================================
// Full U-Plan Schema (for FAS submission)
// ============================================================================

/**
 * Complete U-Plan Schema
 * Validates all required fields for FAS submission
 */
export const UplanSchema = z.object({
  // Auto-generated fields
  idplan: z.number().int().optional(),
  nameplan: z.string().optional(),
  
  // Required editable fields
  dataOwnerIdentifier: DataIdentifierSchema,
  dataSourceIdentifier: DataIdentifierSchema,
  contactDetails: ContactDetailsSchema,
  flightDetails: FlightDetailsSchema,
  uas: UASSchema,
  operatorId: z.string().min(1, 'Operator ID is required'),
  
  // Auto-generated location fields (read-only in form)
  takeoffLocation: GeoJSONPointSchema.optional(),
  landingLocation: GeoJSONPointSchema.optional(),
  gcsLocation: GeoJSONPointSchema.optional(),
  
  // Auto-generated volume fields (read-only in form)
  operationVolumes: z.array(OperationVolumeSchema).optional(),
  
  // State and timestamps
  state: StateEnum.optional(),
  creationTime: z.string().datetime().optional(),
  updateTime: z.string().datetime().optional(),
});
export type Uplan = z.infer<typeof UplanSchema>;

// ============================================================================
// Partial U-Plan Schema (for draft saving)
// ============================================================================

/**
 * Data Identifier Schema for partial validation
 */
const DataIdentifierPartialSchema = z.object({
  sac: z.string().max(3).optional().or(z.literal('')),
  sic: z.string().max(3).optional().or(z.literal('')),
}).optional();

/**
 * Contact Details Schema for partial validation
 */
const ContactDetailsPartialSchema = z.object({
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().optional().or(z.literal('')),
  phones: z.union([
    z.string(),
    z.array(z.string()),
  ]).optional(),
  emails: z.union([
    z.string(),
    z.array(z.string()),
  ]).optional(),
}).optional();

/**
 * Flight Details Schema for partial validation
 */
const FlightDetailsPartialSchema = z.object({
  mode: FlightModeEnum.optional(),
  category: FlightCategoryEnum.optional(),
  specialOperation: SpecialOperationEnum.optional(),
  privateFlight: z.boolean().optional(),
}).optional();

/**
 * Flight Characteristics Schema for partial validation
 */
const FlightCharacteristicsPartialSchema = z.object({
  uasMTOM: z.number().optional(),
  uasMaxSpeed: z.number().optional(),
  Connectivity: ConnectivityEnum.optional(),
  idTechnology: IdTechnologyEnum.optional(),
  maxFlightTime: z.number().optional(),
}).optional();

/**
 * General Characteristics Schema for partial validation
 */
const GeneralCharacteristicsPartialSchema = z.object({
  brand: z.string().optional().or(z.literal('')),
  model: z.string().optional().or(z.literal('')),
  typeCertificate: z.string().optional().or(z.literal('')),
  uasType: UasTypeEnum.optional(),
  uasClass: UasClassEnum.optional(),
  uasDimension: UasDimensionEnum.optional(),
}).optional();

/**
 * UAS Schema for partial validation
 */
const UASPartialSchema = z.object({
  registrationNumber: z.string().optional().or(z.literal('')),
  serialNumber: z.string().max(20).optional().or(z.literal('')),
  flightCharacteristics: FlightCharacteristicsPartialSchema,
  generalCharacteristics: GeneralCharacteristicsPartialSchema,
}).optional();

/**
 * Partial U-Plan Schema
 * Allows saving drafts with incomplete data
 */
export const UplanPartialSchema = z.object({
  // Auto-generated fields
  idplan: z.number().int().optional(),
  nameplan: z.string().optional(),
  
  // Partially editable fields
  dataOwnerIdentifier: DataIdentifierPartialSchema,
  dataSourceIdentifier: DataIdentifierPartialSchema,
  contactDetails: ContactDetailsPartialSchema,
  flightDetails: FlightDetailsPartialSchema,
  uas: UASPartialSchema,
  operatorId: z.string().optional().or(z.literal('')),
  
  // Auto-generated location fields
  takeoffLocation: GeoJSONPointSchema.optional(),
  landingLocation: GeoJSONPointSchema.optional(),
  gcsLocation: GeoJSONPointSchema.optional(),
  
  // Auto-generated volume fields
  operationVolumes: z.array(OperationVolumeSchema).optional(),
  
  // State and timestamps
  state: StateEnum.optional(),
  creationTime: z.string().datetime().optional(),
  updateTime: z.string().datetime().optional(),
});
export type UplanPartial = z.infer<typeof UplanPartialSchema>;

// ============================================================================
// Form-Specific Schema (just the editable fields)
// ============================================================================

/**
 * Schema for form data - only editable fields
 */
export const UplanFormDataSchema = z.object({
  dataOwnerIdentifier: DataIdentifierSchema,
  dataSourceIdentifier: DataIdentifierSchema,
  contactDetails: ContactDetailsSchema,
  flightDetails: FlightDetailsSchema,
  uas: UASSchema,
  operatorId: z.string().min(1, 'Operator ID is required'),
});
export type UplanFormData = z.infer<typeof UplanFormDataSchema>;

/**
 * Partial form data schema for draft saving
 */
export const UplanFormDataPartialSchema = z.object({
  dataOwnerIdentifier: DataIdentifierPartialSchema,
  dataSourceIdentifier: DataIdentifierPartialSchema,
  contactDetails: ContactDetailsPartialSchema,
  flightDetails: FlightDetailsPartialSchema,
  uas: UASPartialSchema,
  operatorId: z.string().optional().or(z.literal('')),
});
export type UplanFormDataPartial = z.infer<typeof UplanFormDataPartialSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: UplanValidationErrors;
}

/**
 * Structured validation errors for UI display
 */
export interface UplanValidationErrors {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
  /** Nested errors for complex fields */
  nestedErrors?: {
    dataOwnerIdentifier?: Record<string, string[]>;
    dataSourceIdentifier?: Record<string, string[]>;
    contactDetails?: Record<string, string[]>;
    flightDetails?: Record<string, string[]>;
    uas?: {
      root?: Record<string, string[]>;
      flightCharacteristics?: Record<string, string[]>;
      generalCharacteristics?: Record<string, string[]>;
    };
  };
}

/**
 * Validates a complete U-Plan for FAS submission.
 * All required fields must be present and valid.
 * 
 * @param data - The U-Plan data to validate
 * @returns Validation result with typed data or errors
 * 
 * @example
 * ```typescript
 * const result = validateUplan(formData);
 * if (result.success) {
 *   // Submit to FAS
 *   await submitToFas(result.data);
 * } else {
 *   // Show errors
 *   setErrors(result.errors);
 * }
 * ```
 */
export function validateUplan(data: unknown): ValidationResult<Uplan> {
  const result = UplanSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Validates a partial U-Plan for draft saving.
 * Allows missing or empty fields.
 * 
 * @param data - The partial U-Plan data to validate
 * @returns Validation result with typed data or errors
 * 
 * @example
 * ```typescript
 * const result = validateUplanPartial(draftData);
 * if (result.success) {
 *   await saveDraft(result.data);
 * }
 * ```
 */
export function validateUplanPartial(data: unknown): ValidationResult<UplanPartial> {
  const result = UplanPartialSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Validates just the form data (editable fields only).
 * Use this for form validation before submission.
 * 
 * @param data - The form data to validate
 * @returns Validation result with typed data or errors
 */
export function validateUplanFormData(data: unknown): ValidationResult<UplanFormData> {
  const result = UplanFormDataSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Gets validation errors for a U-Plan without throwing.
 * Returns null if valid, or structured errors if invalid.
 * 
 * @param data - The U-Plan data to validate
 * @returns Null if valid, or validation errors
 * 
 * @example
 * ```typescript
 * const errors = getValidationErrors(formData);
 * if (errors) {
 *   // Handle errors
 *   console.log(errors.fieldErrors);
 * } else {
 *   // Data is valid
 *   submitForm();
 * }
 * ```
 */
export function getValidationErrors(data: unknown): UplanValidationErrors | null {
  const result = UplanSchema.safeParse(data);
  
  if (result.success) {
    return null;
  }
  
  return formatZodErrors(result.error);
}

/**
 * Gets validation errors for partial data (draft mode).
 * 
 * @param data - The partial U-Plan data to validate
 * @returns Null if valid, or validation errors
 */
export function getPartialValidationErrors(data: unknown): UplanValidationErrors | null {
  const result = UplanPartialSchema.safeParse(data);
  
  if (result.success) {
    return null;
  }
  
  return formatZodErrors(result.error);
}

/**
 * Checks if the U-Plan form data is complete and valid for FAS submission.
 * 
 * @param data - The U-Plan data to check
 * @returns True if complete and valid
 */
export function isUplanComplete(data: unknown): boolean {
  const result = UplanFormDataSchema.safeParse(data);
  return result.success;
}

/**
 * Formats Zod errors into a structured format for UI display.
 * Handles nested objects and provides clear field paths.
 * 
 * @param error - The Zod error to format
 * @returns Structured validation errors
 */
function formatZodErrors(error: z.ZodError): UplanValidationErrors {
  const flattened = error.flatten();
  const formatted: UplanValidationErrors = {
    formErrors: flattened.formErrors,
    fieldErrors: {},
    nestedErrors: {
      dataOwnerIdentifier: {},
      dataSourceIdentifier: {},
      contactDetails: {},
      flightDetails: {},
      uas: {
        root: {},
        flightCharacteristics: {},
        generalCharacteristics: {},
      },
    },
  };

  // Process each error issue for better path tracking
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    const message = issue.message;

    // Top-level field errors
    if (issue.path.length === 1) {
      const key = issue.path[0] as string;
      if (!formatted.fieldErrors[key]) {
        formatted.fieldErrors[key] = [];
      }
      formatted.fieldErrors[key].push(message);
    }
    // Nested errors
    else if (issue.path.length >= 2) {
      const [parent, child, ...rest] = issue.path;
      const parentKey = parent as string;
      const childKey = child as string;

      // Handle dataOwnerIdentifier and dataSourceIdentifier
      if (parentKey === 'dataOwnerIdentifier' || parentKey === 'dataSourceIdentifier') {
        const nestedObj = formatted.nestedErrors![parentKey as keyof typeof formatted.nestedErrors] as Record<string, string[]>;
        if (!nestedObj[childKey]) {
          nestedObj[childKey] = [];
        }
        nestedObj[childKey].push(message);
      }
      // Handle contactDetails
      else if (parentKey === 'contactDetails') {
        const nestedObj = formatted.nestedErrors!.contactDetails!;
        if (!nestedObj[childKey]) {
          nestedObj[childKey] = [];
        }
        nestedObj[childKey].push(message);
      }
      // Handle flightDetails
      else if (parentKey === 'flightDetails') {
        const nestedObj = formatted.nestedErrors!.flightDetails!;
        if (!nestedObj[childKey]) {
          nestedObj[childKey] = [];
        }
        nestedObj[childKey].push(message);
      }
      // Handle uas
      else if (parentKey === 'uas') {
        if (rest.length === 0) {
          // Direct child of uas (registrationNumber, serialNumber)
          if (!formatted.nestedErrors!.uas!.root![childKey]) {
            formatted.nestedErrors!.uas!.root![childKey] = [];
          }
          formatted.nestedErrors!.uas!.root![childKey].push(message);
        } else {
          // Nested inside flightCharacteristics or generalCharacteristics
          const subChild = rest[0] as string;
          if (childKey === 'flightCharacteristics') {
            if (!formatted.nestedErrors!.uas!.flightCharacteristics![subChild]) {
              formatted.nestedErrors!.uas!.flightCharacteristics![subChild] = [];
            }
            formatted.nestedErrors!.uas!.flightCharacteristics![subChild].push(message);
          } else if (childKey === 'generalCharacteristics') {
            if (!formatted.nestedErrors!.uas!.generalCharacteristics![subChild]) {
              formatted.nestedErrors!.uas!.generalCharacteristics![subChild] = [];
            }
            formatted.nestedErrors!.uas!.generalCharacteristics![subChild].push(message);
          }
        }
      }

      // Also add to flat fieldErrors with full path
      if (!formatted.fieldErrors[path]) {
        formatted.fieldErrors[path] = [];
      }
      formatted.fieldErrors[path].push(message);
    }
  }

  return formatted;
}

// ============================================================================
// Default/Empty Values
// ============================================================================

/**
 * Creates an empty form data object with default values.
 * Useful for initializing the form with no existing data.
 */
export function createEmptyUplanFormData(): UplanFormDataPartial {
  return {
    dataOwnerIdentifier: {
      sac: '',
      sic: '',
    },
    dataSourceIdentifier: {
      sac: '',
      sic: '',
    },
    contactDetails: {
      firstName: '',
      lastName: '',
      phones: [],
      emails: [],
    },
    flightDetails: {
      mode: undefined,
      category: undefined,
      specialOperation: '',
      privateFlight: false,
    },
    uas: {
      registrationNumber: '',
      serialNumber: '',
      flightCharacteristics: {
        uasMTOM: undefined,
        uasMaxSpeed: undefined,
        Connectivity: undefined,
        idTechnology: undefined,
        maxFlightTime: undefined,
      },
      generalCharacteristics: {
        brand: '',
        model: '',
        typeCertificate: '',
        uasType: undefined,
        uasClass: undefined,
        uasDimension: undefined,
      },
    },
    operatorId: '',
  };
}

/**
 * Merges existing U-Plan data with empty form data to fill gaps.
 * Useful for pre-populating a form with partial existing data.
 * 
 * @param existing - Existing U-Plan data (can be partial or undefined)
 * @returns Merged form data with defaults for missing fields
 */
export function mergeWithDefaults(existing: unknown): UplanFormDataPartial {
  const defaults = createEmptyUplanFormData();
  
  if (!existing || typeof existing !== 'object') {
    return defaults;
  }
  
  const data = existing as Record<string, unknown>;
  
  return {
    dataOwnerIdentifier: {
      sac: (data.dataOwnerIdentifier as Record<string, string>)?.sac ?? defaults.dataOwnerIdentifier?.sac,
      sic: (data.dataOwnerIdentifier as Record<string, string>)?.sic ?? defaults.dataOwnerIdentifier?.sic,
    },
    dataSourceIdentifier: {
      sac: (data.dataSourceIdentifier as Record<string, string>)?.sac ?? defaults.dataSourceIdentifier?.sac,
      sic: (data.dataSourceIdentifier as Record<string, string>)?.sic ?? defaults.dataSourceIdentifier?.sic,
    },
    contactDetails: {
      firstName: (data.contactDetails as Record<string, unknown>)?.firstName as string ?? defaults.contactDetails?.firstName,
      lastName: (data.contactDetails as Record<string, unknown>)?.lastName as string ?? defaults.contactDetails?.lastName,
      phones: (data.contactDetails as Record<string, unknown>)?.phones as string | string[] | undefined ?? defaults.contactDetails?.phones,
      emails: (data.contactDetails as Record<string, unknown>)?.emails as string | string[] | undefined ?? defaults.contactDetails?.emails,
    },
    flightDetails: {
      mode: (data.flightDetails as Record<string, unknown>)?.mode as FlightMode | undefined ?? defaults.flightDetails?.mode,
      category: (data.flightDetails as Record<string, unknown>)?.category as FlightCategory | undefined ?? defaults.flightDetails?.category,
      specialOperation: (data.flightDetails as Record<string, unknown>)?.specialOperation as SpecialOperation | undefined ?? defaults.flightDetails?.specialOperation,
      privateFlight: (data.flightDetails as Record<string, unknown>)?.privateFlight as boolean ?? defaults.flightDetails?.privateFlight,
    },
    uas: {
      registrationNumber: (data.uas as Record<string, unknown>)?.registrationNumber as string ?? defaults.uas?.registrationNumber,
      serialNumber: (data.uas as Record<string, unknown>)?.serialNumber as string ?? defaults.uas?.serialNumber,
      flightCharacteristics: {
        uasMTOM: ((data.uas as Record<string, unknown>)?.flightCharacteristics as Record<string, unknown>)?.uasMTOM as number | undefined ?? defaults.uas?.flightCharacteristics?.uasMTOM,
        uasMaxSpeed: ((data.uas as Record<string, unknown>)?.flightCharacteristics as Record<string, unknown>)?.uasMaxSpeed as number | undefined ?? defaults.uas?.flightCharacteristics?.uasMaxSpeed,
        Connectivity: ((data.uas as Record<string, unknown>)?.flightCharacteristics as Record<string, unknown>)?.Connectivity as Connectivity | undefined ?? defaults.uas?.flightCharacteristics?.Connectivity,
        idTechnology: ((data.uas as Record<string, unknown>)?.flightCharacteristics as Record<string, unknown>)?.idTechnology as IdTechnology | undefined ?? defaults.uas?.flightCharacteristics?.idTechnology,
        maxFlightTime: ((data.uas as Record<string, unknown>)?.flightCharacteristics as Record<string, unknown>)?.maxFlightTime as number | undefined ?? defaults.uas?.flightCharacteristics?.maxFlightTime,
      },
      generalCharacteristics: {
        brand: ((data.uas as Record<string, unknown>)?.generalCharacteristics as Record<string, unknown>)?.brand as string ?? defaults.uas?.generalCharacteristics?.brand,
        model: ((data.uas as Record<string, unknown>)?.generalCharacteristics as Record<string, unknown>)?.model as string ?? defaults.uas?.generalCharacteristics?.model,
        typeCertificate: ((data.uas as Record<string, unknown>)?.generalCharacteristics as Record<string, unknown>)?.typeCertificate as string ?? defaults.uas?.generalCharacteristics?.typeCertificate,
        uasType: ((data.uas as Record<string, unknown>)?.generalCharacteristics as Record<string, unknown>)?.uasType as UasType | undefined ?? defaults.uas?.generalCharacteristics?.uasType,
        uasClass: ((data.uas as Record<string, unknown>)?.generalCharacteristics as Record<string, unknown>)?.uasClass as UasClass | undefined ?? defaults.uas?.generalCharacteristics?.uasClass,
        uasDimension: ((data.uas as Record<string, unknown>)?.generalCharacteristics as Record<string, unknown>)?.uasDimension as UasDimension | undefined ?? defaults.uas?.generalCharacteristics?.uasDimension,
      },
    },
    operatorId: data.operatorId as string ?? defaults.operatorId,
  };
}

// ============================================================================
// Dropdown Options for UI
// ============================================================================

/**
 * Options for dropdown fields in the U-Plan form.
 * Provides human-readable labels for enum values.
 */
export const UplanDropdownOptions = {
  mode: [
    { value: 'VLOS', label: 'VLOS (Visual Line of Sight)' },
    { value: 'BVLOS', label: 'BVLOS (Beyond Visual Line of Sight)' },
  ],
  category: [
    { value: 'OPENA1', label: 'Open A1' },
    { value: 'OPENA2', label: 'Open A2' },
    { value: 'OPENA3', label: 'Open A3' },
    { value: 'SAIL_I-II', label: 'SAIL I-II' },
    { value: 'SAIL_III-IV', label: 'SAIL III-IV' },
    { value: 'SAIL_V-VI', label: 'SAIL V-VI' },
    { value: 'Certi_No_Pass', label: 'Certified (No Passengers)' },
    { value: 'Certi_Pass', label: 'Certified (With Passengers)' },
  ],
  specialOperation: [
    { value: '', label: 'None' },
    { value: 'POLICE_AND_CUSTOMS', label: 'Police and Customs' },
    { value: 'TRAFFIC_SURVEILLANCE_AND_PURSUIT', label: 'Traffic Surveillance and Pursuit' },
    { value: 'ENVIRONMENTAL_CONTROL', label: 'Environmental Control' },
    { value: 'SEARCH_AND_RESCUE', label: 'Search and Rescue' },
    { value: 'MEDICAL', label: 'Medical' },
    { value: 'EVACUATIONS', label: 'Evacuations' },
    { value: 'FIREFIGHTING', label: 'Firefighting' },
    { value: 'STATE_OFFICIALS', label: 'State Officials' },
  ],
  connectivity: [
    { value: 'RF', label: 'RF (Radio Frequency)' },
    { value: 'LTE', label: 'LTE' },
    { value: 'SAT', label: 'Satellite' },
    { value: '5G', label: '5G' },
  ],
  idTechnology: [
    { value: 'NRID', label: 'Network Remote ID (NRID)' },
    { value: 'ADSB', label: 'ADS-B' },
    { value: 'OTHER', label: 'Other' },
  ],
  uasType: [
    { value: 'NONE_NOT_DECLARED', label: 'Not Declared' },
    { value: 'MULTIROTOR', label: 'Multirotor' },
    { value: 'FIXED_WING', label: 'Fixed Wing' },
  ],
  uasClass: [
    { value: 'NONE', label: 'None' },
    { value: 'C0', label: 'C0' },
    { value: 'C1', label: 'C1' },
    { value: 'C2', label: 'C2' },
    { value: 'C3', label: 'C3' },
    { value: 'C4', label: 'C4' },
    { value: 'C5', label: 'C5' },
    { value: 'C6', label: 'C6' },
  ],
  uasDimension: [
    { value: 'LT_1', label: 'Less than 1m' },
    { value: 'LT_3', label: 'Less than 3m' },
    { value: 'LT_8', label: 'Less than 8m' },
    { value: 'GTE_8', label: '8m or more' },
  ],
} as const;
