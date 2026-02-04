/**
 * Zod Validation Schemas for UAS Planner API
 * 
 * This module provides type-safe validation schemas for all API inputs
 * including request bodies, query parameters, and path parameters.
 * 
 * Features:
 * - Comprehensive schemas for auth, flight plans, folders, CSV results
 * - Type inference with `z.infer<typeof schema>`
 * - Helper functions for request body parsing
 * - Custom ValidationError class for structured error responses
 * 
 * @module lib/validators
 * 
 * @example
 * ```typescript
 * import { loginSchema, LoginInput, parseBody } from '@/lib/validators'
 * 
 * // In API route:
 * const body = await request.json()
 * const data = parseBody(loginSchema, body) // Throws ValidationError if invalid
 * ```
 */

import { z } from 'zod'

// ============================================================================
// Common Schemas & Utilities
// ============================================================================

/**
 * Schema for positive integer IDs (path params and references).
 * Coerces string input to number for query parameter handling.
 */
export const idSchema = z.coerce.number().int().positive()

/**
 * Schema for arrays of IDs in bulk operations.
 * Limits to 100,000 items to prevent abuse.
 */
export const idsArraySchema = z.array(idSchema).min(1).max(100000)

/**
 * Schema for optional nullable IDs (foreign key references).
 */
export const optionalIdSchema = z.coerce.number().int().positive().nullable().optional()

/**
 * Schema for ISO 8601 date strings.
 * Accepts both datetime format and any Date-parseable string.
 */
export const dateStringSchema = z.string().datetime().or(z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date format' }
))

/**
 * Schema for optional nullable dates.
 */
export const optionalDateSchema = dateStringSchema.nullable().optional()

// ============================================================================
// Auth Schemas
// ============================================================================

/**
 * Schema for login request body.
 * Validates email format and requires non-empty password.
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

/** Type for validated login input */
export type LoginInput = z.infer<typeof loginSchema>

/**
 * Schema for signup request body.
 * Enforces minimum 8 character password for security.
 */
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/** Type for validated signup input */
export type SignupInput = z.infer<typeof signupSchema>

// ============================================================================
// Flight Plan Schemas
// ============================================================================

/** Valid flight plan statuses */
export const flightPlanStatusSchema = z.enum([
  'sin procesar',
  'en cola',
  'procesando',
  'procesado',
  'error',
]);
export type FlightPlanStatus = z.infer<typeof flightPlanStatusSchema>;

/** Valid authorization statuses */
export const authorizationStatusSchema = z.enum([
  'sin autorización',
  'pendiente',
  'autorizado',
  'rechazado',
]);
export type AuthorizationStatus = z.infer<typeof authorizationStatusSchema>;

/** Create a single flight plan */
export const flightPlanCreateSchema = z.object({
  customName: z.string().min(1, 'Name is required').max(255),
  status: flightPlanStatusSchema,
  fileContent: z.string().min(1, 'File content is required'),
  userId: idSchema,
  folderId: optionalIdSchema,
  uplan: z.unknown().nullable().optional(),
  scheduledAt: optionalDateSchema,
});
export type FlightPlanCreateInput = z.infer<typeof flightPlanCreateSchema>;

/** Bulk create flight plans */
export const flightPlanBulkCreateSchema = z.object({
  items: z.array(flightPlanCreateSchema).min(1).max(2000),
});
export type FlightPlanBulkCreateInput = z.infer<typeof flightPlanBulkCreateSchema>;

/** Update a single flight plan (partial) */
export const flightPlanUpdateDataSchema = z.object({
  customName: z.string().min(1).max(255).optional(),
  status: flightPlanStatusSchema.optional(),
  fileContent: z.string().min(1).optional(),
  authorizationStatus: authorizationStatusSchema.optional(),
  authorizationMessage: z.unknown().nullable().optional(),
  uplan: z.unknown().nullable().optional(),
  scheduledAt: optionalDateSchema,
  csvResult: z.number().int().positive().nullable().optional(),
  machineAssignedId: z.number().int().positive().nullable().optional(),
  folderId: z.number().int().positive().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});
export type FlightPlanUpdateData = z.infer<typeof flightPlanUpdateDataSchema>;

/** Single flight plan update request */
export const flightPlanUpdateSchema = z.object({
  id: idSchema,
  data: flightPlanUpdateDataSchema,
});
export type FlightPlanUpdateInput = z.infer<typeof flightPlanUpdateSchema>;

/** Bulk update with same data for all */
export const flightPlanBulkUniformUpdateSchema = z.object({
  ids: idsArraySchema,
  data: flightPlanUpdateDataSchema,
});
export type FlightPlanBulkUniformUpdateInput = z.infer<typeof flightPlanBulkUniformUpdateSchema>;

/** Bulk update with different data per item */
export const flightPlanBulkItemUpdateSchema = z.object({
  items: z.array(flightPlanUpdateSchema).min(1).max(2000),
});
export type FlightPlanBulkItemUpdateInput = z.infer<typeof flightPlanBulkItemUpdateSchema>;

/** Delete flight plans */
export const flightPlanDeleteSchema = z.object({
  id: idSchema.optional(),
  ids: idsArraySchema.optional(),
}).refine((data) => data.id !== undefined || data.ids !== undefined, {
  message: 'Either id or ids must be provided',
});
export type FlightPlanDeleteInput = z.infer<typeof flightPlanDeleteSchema>;

/** Query params for listing flight plans */
export const flightPlanQuerySchema = z.object({
  userId: idSchema,
});
export type FlightPlanQueryInput = z.infer<typeof flightPlanQuerySchema>;

// ============================================================================
// Folder Schemas
// ============================================================================

/** Create a folder */
export const folderCreateSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(255),
  userId: idSchema,
  minScheduledAt: optionalDateSchema,
  maxScheduledAt: optionalDateSchema,
});
export type FolderCreateInput = z.infer<typeof folderCreateSchema>;

/** Update/rename a folder */
export const folderUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  minScheduledAt: optionalDateSchema,
  maxScheduledAt: optionalDateSchema,
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});
export type FolderUpdateInput = z.infer<typeof folderUpdateSchema>;

/** Query params for listing folders */
export const folderQuerySchema = z.object({
  userId: idSchema,
});
export type FolderQueryInput = z.infer<typeof folderQuerySchema>;

// ============================================================================
// CSV Result Schemas
// ============================================================================

/** Create a CSV result */
export const csvResultCreateSchema = z.object({
  csvResult: z.string().min(1, 'CSV content is required'),
});
export type CsvResultCreateInput = z.infer<typeof csvResultCreateSchema>;

/** Bulk fetch CSV results */
export const csvResultBulkFetchSchema = z.object({
  ids: idsArraySchema.max(5000),
});
export type CsvResultBulkFetchInput = z.infer<typeof csvResultBulkFetchSchema>;

/** Delete CSV results */
export const csvResultDeleteSchema = z.object({
  id: idSchema.optional(),
  ids: z.array(idSchema).min(1).max(5000).optional(),
}).refine((data) => data.id !== undefined || data.ids !== undefined, {
  message: 'Either id or ids must be provided',
});
export type CsvResultDeleteInput = z.infer<typeof csvResultDeleteSchema>;

// ============================================================================
// Machine Schemas
// ============================================================================

/** Valid machine statuses */
export const machineStatusSchema = z.enum([
  'Disponible',
  'Ocupado',
  'En mantenimiento',
]);
export type MachineStatus = z.infer<typeof machineStatusSchema>;

/** Create a machine */
export const machineCreateSchema = z.object({
  name: z.string().min(1, 'Machine name is required').max(255),
  status: machineStatusSchema,
});
export type MachineCreateInput = z.infer<typeof machineCreateSchema>;

/** Update machine status */
export const machineUpdateSchema = z.object({
  status: machineStatusSchema,
});
export type MachineUpdateInput = z.infer<typeof machineUpdateSchema>;

/** Query machine by name */
export const machineQuerySchema = z.object({
  name: z.string().min(1),
});
export type MachineQueryInput = z.infer<typeof machineQuerySchema>;

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/** Generic ID path parameter */
export const idParamSchema = z.object({
  id: idSchema,
});
export type IdParam = z.infer<typeof idParamSchema>;

/** External response number path parameter (for FAS) */
export const externalResponseNumberParamSchema = z.object({
  externalResponseNumber: z.string().min(1),
});
export type ExternalResponseNumberParam = z.infer<typeof externalResponseNumberParamSchema>;

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Flattened error structure from Zod validation.
 * Contains both form-level errors and field-specific errors.
 * 
 * @template T - The type being validated
 */
export type FlattenedErrors<T = unknown> = {
  formErrors: string[]
  fieldErrors: { [K in keyof T]?: string[] }
}

/**
 * Parses and validates a request body using a Zod schema.
 * Throws a ValidationError with structured error details on failure.
 * 
 * @param schema - The Zod schema to validate against
 * @param body - The request body to validate
 * @returns The validated and typed data
 * @throws {ValidationError} When validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   const data = parseBody(loginSchema, await request.json())
 *   // data is typed as LoginInput
 * } catch (error) {
 *   if (isValidationError(error)) {
 *     return Response.json(error.toJSON(), { status: 400 })
 *   }
 * }
 * ```
 */
export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): z.infer<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    const errors = result.error.flatten()
    throw new ValidationError('Validation failed', errors)
  }
  return result.data
}

/**
 * Safely parses a request body without throwing.
 * Returns a discriminated union for explicit error handling.
 * 
 * @param schema - The Zod schema to validate against
 * @param body - The request body to validate
 * @returns Success with data, or failure with flattened errors
 * 
 * @example
 * ```typescript
 * const result = safeParseBody(loginSchema, body)
 * if (!result.success) {
 *   return Response.json({ errors: result.errors }, { status: 400 })
 * }
 * // result.data is typed as LoginInput
 * ```
 */
export function safeParseBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: FlattenedErrors<z.infer<T>> } {
  const result = schema.safeParse(body)
  if (!result.success) {
    return { success: false, errors: result.error.flatten() as FlattenedErrors<z.infer<T>> }
  }
  return { success: true, data: result.data }
}

/**
 * Custom error class for validation failures.
 * Provides structured error information for API responses.
 * 
 * @example
 * ```typescript
 * throw new ValidationError('Invalid input', {
 *   formErrors: [],
 *   fieldErrors: { email: ['Invalid email format'] }
 * })
 * ```
 */
export class ValidationError extends Error {
  /** Flattened validation errors */
  public readonly errors: FlattenedErrors
  /** HTTP status code (always 400 for validation) */
  public readonly statusCode = 400

  constructor(message: string, errors: FlattenedErrors) {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
  }

  /**
   * Converts the error to a JSON-serializable format for API responses.
   */
  toJSON() {
    return {
      error: this.message,
      details: this.errors,
    }
  }
}

/**
 * Type guard to check if an error is a ValidationError.
 * 
 * @param error - The error to check
 * @returns true if the error is a ValidationError instance
 * 
 * @example
 * ```typescript
 * try {
 *   parseBody(schema, body)
 * } catch (error) {
 *   if (isValidationError(error)) {
 *     return Response.json(error.toJSON(), { status: error.statusCode })
 *   }
 *   throw error
 * }
 * ```
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}
