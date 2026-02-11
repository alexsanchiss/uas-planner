/**
 * Unit tests for API validators
 * 
 * TASK-208: Test API validators (lib/validators.ts)
 */

import {
  idSchema,
  idsArraySchema,
  optionalIdSchema,
  dateStringSchema,
  loginSchema,
  signupSchema,
  flightPlanStatusSchema,
  authorizationStatusSchema,
  flightPlanCreateSchema,
  flightPlanUpdateDataSchema,
  flightPlanDeleteSchema,
  externalUplanSchema,
  folderCreateSchema,
  folderUpdateSchema,
  csvResultCreateSchema,
  csvResultBulkFetchSchema,
  machineStatusSchema,
  machineCreateSchema,
  parseBody,
  safeParseBody,
  ValidationError,
  isValidationError,
} from '../validators';

describe('Validators', () => {
  describe('ID Schemas', () => {
    describe('idSchema', () => {
      it('should accept positive integers', () => {
        expect(idSchema.parse(1)).toBe(1);
        expect(idSchema.parse(999)).toBe(999);
        expect(idSchema.parse('123')).toBe(123); // coerced
      });

      it('should reject zero', () => {
        expect(() => idSchema.parse(0)).toThrow();
      });

      it('should reject negative numbers', () => {
        expect(() => idSchema.parse(-1)).toThrow();
      });

      it('should reject non-integers', () => {
        expect(() => idSchema.parse(1.5)).toThrow();
      });

      it('should reject non-numeric strings', () => {
        expect(() => idSchema.parse('abc')).toThrow();
      });
    });

    describe('idsArraySchema', () => {
      it('should accept array of valid IDs', () => {
        const result = idsArraySchema.parse([1, 2, 3]);
        expect(result).toEqual([1, 2, 3]);
      });

      it('should reject empty array', () => {
        expect(() => idsArraySchema.parse([])).toThrow();
      });

      it('should reject array with invalid IDs', () => {
        expect(() => idsArraySchema.parse([1, -2, 3])).toThrow();
      });
    });

    describe('optionalIdSchema', () => {
      it('should accept valid ID', () => {
        expect(optionalIdSchema.parse(1)).toBe(1);
      });

      it('should accept null', () => {
        expect(optionalIdSchema.parse(null)).toBeNull();
      });

      it('should accept undefined', () => {
        expect(optionalIdSchema.parse(undefined)).toBeUndefined();
      });
    });
  });

  describe('Date Schemas', () => {
    describe('dateStringSchema', () => {
      it('should accept ISO datetime strings', () => {
        const date = '2024-01-15T10:30:00.000Z';
        expect(dateStringSchema.parse(date)).toBe(date);
      });

      it('should accept parseable date strings', () => {
        const date = '2024-01-15';
        expect(dateStringSchema.parse(date)).toBe(date);
      });

      it('should reject invalid date strings', () => {
        expect(() => dateStringSchema.parse('not-a-date')).toThrow();
      });
    });
  });

  describe('Auth Schemas', () => {
    describe('loginSchema', () => {
      it('should accept valid login credentials', () => {
        const result = loginSchema.parse({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(result.email).toBe('test@example.com');
        expect(result.password).toBe('password123');
      });

      it('should reject invalid email', () => {
        expect(() => loginSchema.parse({
          email: 'not-an-email',
          password: 'password123',
        })).toThrow();
      });

      it('should reject empty password', () => {
        expect(() => loginSchema.parse({
          email: 'test@example.com',
          password: '',
        })).toThrow();
      });

      it('should reject missing fields', () => {
        expect(() => loginSchema.parse({})).toThrow();
        expect(() => loginSchema.parse({ email: 'test@example.com' })).toThrow();
        expect(() => loginSchema.parse({ password: 'pass' })).toThrow();
      });
    });

    describe('signupSchema', () => {
      it('should accept valid signup data', () => {
        const result = signupSchema.parse({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(result.email).toBe('test@example.com');
      });

      it('should reject short password', () => {
        expect(() => signupSchema.parse({
          email: 'test@example.com',
          password: '1234567', // 7 chars, minimum is 8
        })).toThrow();
      });

      it('should accept 8 character password', () => {
        const result = signupSchema.parse({
          email: 'test@example.com',
          password: '12345678',
        });
        expect(result.password).toBe('12345678');
      });
    });
  });

  describe('Flight Plan Status Schemas', () => {
    describe('flightPlanStatusSchema', () => {
      const validStatuses = ['sin procesar', 'en cola', 'procesando', 'procesado', 'error'];

      it.each(validStatuses)('should accept "%s" status', (status) => {
        expect(flightPlanStatusSchema.parse(status)).toBe(status);
      });

      it('should reject invalid status', () => {
        expect(() => flightPlanStatusSchema.parse('invalid')).toThrow();
      });
    });

    describe('authorizationStatusSchema', () => {
      const validStatuses = ['sin autorización', 'pendiente', 'autorizado', 'rechazado'];

      it.each(validStatuses)('should accept "%s" status', (status) => {
        expect(authorizationStatusSchema.parse(status)).toBe(status);
      });

      it('should reject invalid status', () => {
        expect(() => authorizationStatusSchema.parse('approved')).toThrow();
      });
    });
  });

  describe('Flight Plan Schemas', () => {
    describe('flightPlanCreateSchema', () => {
      const validInput = {
        customName: 'Test Flight',
        status: 'sin procesar',
        fileContent: 'csv content here',
        userId: 1,
      };

      it('should accept valid create input', () => {
        const result = flightPlanCreateSchema.parse(validInput);
        expect(result.customName).toBe('Test Flight');
        expect(result.userId).toBe(1);
      });

      it('should accept optional folderId', () => {
        const result = flightPlanCreateSchema.parse({
          ...validInput,
          folderId: 5,
        });
        expect(result.folderId).toBe(5);
      });

      it('should accept null folderId', () => {
        const result = flightPlanCreateSchema.parse({
          ...validInput,
          folderId: null,
        });
        expect(result.folderId).toBeNull();
      });

      it('should accept optional scheduledAt', () => {
        const result = flightPlanCreateSchema.parse({
          ...validInput,
          scheduledAt: '2024-01-15T10:00:00Z',
        });
        expect(result.scheduledAt).toBe('2024-01-15T10:00:00Z');
      });

      it('should reject empty customName', () => {
        expect(() => flightPlanCreateSchema.parse({
          ...validInput,
          customName: '',
        })).toThrow();
      });

      it('should reject empty fileContent', () => {
        expect(() => flightPlanCreateSchema.parse({
          ...validInput,
          fileContent: '',
        })).toThrow();
      });
    });

    describe('flightPlanUpdateDataSchema', () => {
      it('should accept partial update', () => {
        const result = flightPlanUpdateDataSchema.parse({
          customName: 'Updated Name',
        });
        expect(result.customName).toBe('Updated Name');
      });

      it('should accept status update', () => {
        const result = flightPlanUpdateDataSchema.parse({
          status: 'procesado',
        });
        expect(result.status).toBe('procesado');
      });

      it('should accept authorization status update', () => {
        const result = flightPlanUpdateDataSchema.parse({
          authorizationStatus: 'autorizado',
        });
        expect(result.authorizationStatus).toBe('autorizado');
      });

      it('should reject empty object', () => {
        expect(() => flightPlanUpdateDataSchema.parse({})).toThrow();
      });

      it('should accept multiple fields', () => {
        const result = flightPlanUpdateDataSchema.parse({
          customName: 'New Name',
          status: 'procesando',
          folderId: 3,
        });
        expect(result.customName).toBe('New Name');
        expect(result.status).toBe('procesando');
        expect(result.folderId).toBe(3);
      });
    });

    describe('flightPlanDeleteSchema', () => {
      it('should accept single id', () => {
        const result = flightPlanDeleteSchema.parse({ id: 1 });
        expect(result.id).toBe(1);
      });

      it('should accept array of ids', () => {
        const result = flightPlanDeleteSchema.parse({ ids: [1, 2, 3] });
        expect(result.ids).toEqual([1, 2, 3]);
      });

      it('should accept both id and ids', () => {
        const result = flightPlanDeleteSchema.parse({ id: 1, ids: [2, 3] });
        expect(result.id).toBe(1);
        expect(result.ids).toEqual([2, 3]);
      });

      it('should reject when neither id nor ids provided', () => {
        expect(() => flightPlanDeleteSchema.parse({})).toThrow();
      });
    });
  });

  describe('External UPLAN Schema', () => {
    describe('externalUplanSchema', () => {
      const validInput = {
        type: 'external_uplan' as const,
        uplan: {
          operationVolumes: [
            {
              geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
              timeBegin: '2024-06-01T10:00:00Z',
              timeEnd: '2024-06-01T11:00:00Z',
              minAltitude: { value: 0, reference: 'AGL', uom: 'm' },
              maxAltitude: { value: 120, reference: 'AGL', uom: 'm' },
              ordinal: 0,
            },
          ],
          operatorId: 'OP-001',
        },
        folderId: 1,
        customName: 'external-plan.json',
      };

      it('should accept valid external UPLAN input', () => {
        const result = externalUplanSchema.parse(validInput);
        expect(result.type).toBe('external_uplan');
        expect(result.customName).toBe('external-plan.json');
        expect(result.folderId).toBe(1);
        expect(result.uplan.operationVolumes).toHaveLength(1);
      });

      it('should reject when type is not external_uplan', () => {
        expect(() => externalUplanSchema.parse({
          ...validInput,
          type: 'other',
        })).toThrow();
      });

      it('should reject empty operationVolumes', () => {
        expect(() => externalUplanSchema.parse({
          ...validInput,
          uplan: { operationVolumes: [] },
        })).toThrow();
      });

      it('should reject missing operationVolumes', () => {
        expect(() => externalUplanSchema.parse({
          ...validInput,
          uplan: {},
        })).toThrow();
      });

      it('should reject missing folderId', () => {
        const { folderId, ...rest } = validInput;
        expect(() => externalUplanSchema.parse(rest)).toThrow();
      });

      it('should reject empty customName', () => {
        expect(() => externalUplanSchema.parse({
          ...validInput,
          customName: '',
        })).toThrow();
      });

      it('should accept uplan with extra fields (passthrough)', () => {
        const result = externalUplanSchema.parse({
          ...validInput,
          uplan: {
            ...validInput.uplan,
            operatorId: 'OP-999',
            extraField: 'allowed',
          },
        });
        expect(result.uplan.operatorId).toBe('OP-999');
      });

      it('should accept volumes without timeBegin (optional)', () => {
        const input = {
          ...validInput,
          uplan: {
            operationVolumes: [{ ordinal: 0 }],
          },
        };
        const result = externalUplanSchema.parse(input);
        expect(result.uplan.operationVolumes[0].timeBegin).toBeUndefined();
      });
    });
  });

  describe('Folder Schemas', () => {
    describe('folderCreateSchema', () => {
      it('should accept valid folder creation', () => {
        const result = folderCreateSchema.parse({
          name: 'My Folder',
          userId: 1,
        });
        expect(result.name).toBe('My Folder');
        expect(result.userId).toBe(1);
      });

      it('should accept optional date ranges', () => {
        const result = folderCreateSchema.parse({
          name: 'My Folder',
          userId: 1,
          minScheduledAt: '2024-01-01T00:00:00Z',
          maxScheduledAt: '2024-12-31T23:59:59Z',
        });
        expect(result.minScheduledAt).toBe('2024-01-01T00:00:00Z');
        expect(result.maxScheduledAt).toBe('2024-12-31T23:59:59Z');
      });

      it('should reject empty name', () => {
        expect(() => folderCreateSchema.parse({
          name: '',
          userId: 1,
        })).toThrow();
      });

      it('should reject missing userId', () => {
        expect(() => folderCreateSchema.parse({
          name: 'Folder',
        })).toThrow();
      });
    });

    describe('folderUpdateSchema', () => {
      it('should accept name update', () => {
        const result = folderUpdateSchema.parse({
          name: 'Updated Folder',
        });
        expect(result.name).toBe('Updated Folder');
      });

      it('should accept date updates', () => {
        const result = folderUpdateSchema.parse({
          minScheduledAt: '2024-06-01T00:00:00Z',
        });
        expect(result.minScheduledAt).toBe('2024-06-01T00:00:00Z');
      });

      it('should reject empty object', () => {
        expect(() => folderUpdateSchema.parse({})).toThrow();
      });
    });
  });

  describe('CSV Result Schemas', () => {
    describe('csvResultCreateSchema', () => {
      it('should accept valid CSV content', () => {
        const result = csvResultCreateSchema.parse({
          csvResult: 'col1,col2\nval1,val2',
        });
        expect(result.csvResult).toBe('col1,col2\nval1,val2');
      });

      it('should reject empty content', () => {
        expect(() => csvResultCreateSchema.parse({
          csvResult: '',
        })).toThrow();
      });
    });

    describe('csvResultBulkFetchSchema', () => {
      it('should accept valid ids array', () => {
        const result = csvResultBulkFetchSchema.parse({
          ids: [1, 2, 3, 4, 5],
        });
        expect(result.ids).toHaveLength(5);
      });

      it('should reject empty array', () => {
        expect(() => csvResultBulkFetchSchema.parse({
          ids: [],
        })).toThrow();
      });
    });
  });

  describe('Machine Schemas', () => {
    describe('machineStatusSchema', () => {
      const validStatuses = ['Disponible', 'Ocupado', 'En mantenimiento'];

      it.each(validStatuses)('should accept "%s" status', (status) => {
        expect(machineStatusSchema.parse(status)).toBe(status);
      });

      it('should reject invalid status', () => {
        expect(() => machineStatusSchema.parse('Offline')).toThrow();
      });
    });

    describe('machineCreateSchema', () => {
      it('should accept valid machine creation', () => {
        const result = machineCreateSchema.parse({
          name: 'Machine-01',
          status: 'Disponible',
        });
        expect(result.name).toBe('Machine-01');
        expect(result.status).toBe('Disponible');
      });

      it('should reject empty name', () => {
        expect(() => machineCreateSchema.parse({
          name: '',
          status: 'Disponible',
        })).toThrow();
      });
    });
  });

  describe('Helper Functions', () => {
    describe('parseBody', () => {
      it('should return parsed data for valid input', () => {
        const result = parseBody(loginSchema, {
          email: 'test@test.com',
          password: 'password123',
        });
        expect(result.email).toBe('test@test.com');
      });

      it('should throw ValidationError for invalid input', () => {
        expect(() => parseBody(loginSchema, {
          email: 'invalid',
          password: '',
        })).toThrow(ValidationError);
      });
    });

    describe('safeParseBody', () => {
      it('should return success with data for valid input', () => {
        const result = safeParseBody(loginSchema, {
          email: 'test@test.com',
          password: 'password123',
        });
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('test@test.com');
        }
      });

      it('should return failure with errors for invalid input', () => {
        const result = safeParseBody(loginSchema, {
          email: 'invalid',
          password: '',
        });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors).toBeDefined();
          expect(result.errors.fieldErrors.email).toBeDefined();
        }
      });
    });

    describe('ValidationError', () => {
      it('should create error with proper properties', () => {
        const error = new ValidationError('Test error', {
          formErrors: ['Form error'],
          fieldErrors: { field1: ['Field error'] },
        });

        expect(error.message).toBe('Test error');
        expect(error.name).toBe('ValidationError');
        expect(error.statusCode).toBe(400);
        expect(error.errors.formErrors).toContain('Form error');
      });

      it('should serialize to JSON properly', () => {
        const error = new ValidationError('Validation failed', {
          formErrors: [],
          fieldErrors: { email: ['Invalid email'] },
        });

        const json = error.toJSON();
        expect(json.error).toBe('Validation failed');
        expect(json.details.fieldErrors.email).toContain('Invalid email');
      });
    });

    describe('isValidationError', () => {
      it('should return true for ValidationError instances', () => {
        const error = new ValidationError('Test', { formErrors: [], fieldErrors: {} });
        expect(isValidationError(error)).toBe(true);
      });

      it('should return false for regular errors', () => {
        const error = new Error('Test');
        expect(isValidationError(error)).toBe(false);
      });

      it('should return false for non-error values', () => {
        expect(isValidationError(null)).toBe(false);
        expect(isValidationError(undefined)).toBe(false);
        expect(isValidationError('string')).toBe(false);
        expect(isValidationError(123)).toBe(false);
      });
    });
  });
});
