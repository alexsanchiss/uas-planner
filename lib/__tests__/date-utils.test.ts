/**
 * Unit tests for date/timezone utilities
 * 
 * TASK-209: Test date/timezone utilities (lib/date-utils.ts)
 */

import {
  utcToLocalDatetimeString,
  localDatetimeStringToUtc,
  getTimezoneInfo,
  formatDateForDisplay,
  isDateInPast,
  isDateInFuture,
  parseIsoDate,
  startOfDay,
  endOfDay,
  addDuration,
  formatDuration,
  isSameDay,
  getRelativeTime,
} from '../date-utils';

describe('Date/Timezone Utilities', () => {
  describe('utcToLocalDatetimeString', () => {
    it('should return empty string for null', () => {
      expect(utcToLocalDatetimeString(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(utcToLocalDatetimeString(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(utcToLocalDatetimeString('')).toBe('');
    });

    it('should convert ISO string to local datetime format', () => {
      const utc = '2024-06-15T12:00:00.000Z';
      const result = utcToLocalDatetimeString(utc);
      
      // Result should be in YYYY-MM-DDTHH:mm format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('should convert Date object to local datetime format', () => {
      const date = new Date('2024-06-15T12:00:00.000Z');
      const result = utcToLocalDatetimeString(date);
      
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('should return empty string for invalid date string', () => {
      expect(utcToLocalDatetimeString('invalid-date')).toBe('');
    });

    it('should handle midnight correctly', () => {
      const utc = '2024-01-01T00:00:00.000Z';
      const result = utcToLocalDatetimeString(utc);
      
      expect(result).toBeTruthy();
      expect(result.length).toBe(16); // YYYY-MM-DDTHH:mm
    });

    it('should preserve date parts correctly', () => {
      // Use a date far in the future to avoid timezone edge cases
      const date = new Date(2024, 5, 15, 14, 30, 0); // June 15, 2024, 14:30 local
      const result = utcToLocalDatetimeString(date);
      
      expect(result).toBe('2024-06-15T14:30');
    });
  });

  describe('localDatetimeStringToUtc', () => {
    it('should return empty string for empty input', () => {
      expect(localDatetimeStringToUtc('')).toBe('');
    });

    it('should convert local datetime to UTC ISO string', () => {
      const local = '2024-06-15T14:30';
      const result = localDatetimeStringToUtc(local);
      
      // Result should be ISO string ending with Z
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should return empty string for invalid input', () => {
      expect(localDatetimeStringToUtc('invalid')).toBe('');
    });

    it('should be inverse of utcToLocalDatetimeString', () => {
      const original = new Date('2024-06-15T12:00:00.000Z');
      const local = utcToLocalDatetimeString(original);
      const backToUtc = localDatetimeStringToUtc(local);
      
      // Converting back should give us same time (within minute precision)
      const parsed = new Date(backToUtc);
      expect(parsed.getUTCFullYear()).toBe(original.getUTCFullYear());
      expect(parsed.getUTCMonth()).toBe(original.getUTCMonth());
      expect(parsed.getUTCDate()).toBe(original.getUTCDate());
      expect(parsed.getUTCHours()).toBe(original.getUTCHours());
      expect(parsed.getUTCMinutes()).toBe(original.getUTCMinutes());
    });
  });

  describe('getTimezoneInfo', () => {
    it('should return valid timezone info', () => {
      const info = getTimezoneInfo();
      
      expect(info).toHaveProperty('offset');
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('abbreviation');
      expect(info).toHaveProperty('offsetMinutes');
    });

    it('should return offset in UTC±HH:MM format', () => {
      const info = getTimezoneInfo();
      
      expect(info.offset).toMatch(/^UTC[+-]\d{2}:\d{2}$/);
    });

    it('should return a valid timezone name', () => {
      const info = getTimezoneInfo();
      
      // Timezone names typically contain a slash
      expect(typeof info.name).toBe('string');
      expect(info.name.length).toBeGreaterThan(0);
    });

    it('should return offsetMinutes as number', () => {
      const info = getTimezoneInfo();
      
      expect(typeof info.offsetMinutes).toBe('number');
    });
  });

  describe('formatDateForDisplay', () => {
    it('should return placeholder for null', () => {
      expect(formatDateForDisplay(null)).toBe('No programado');
    });

    it('should return placeholder for undefined', () => {
      expect(formatDateForDisplay(undefined)).toBe('No programado');
    });

    it('should format valid date string', () => {
      const date = '2024-06-15T14:30:00.000Z';
      const result = formatDateForDisplay(date);
      
      expect(result).not.toBe('No programado');
      expect(result).not.toBe('Fecha inválida');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format Date object', () => {
      const date = new Date('2024-06-15T14:30:00.000Z');
      const result = formatDateForDisplay(date);
      
      expect(result).not.toBe('No programado');
      expect(result).not.toBe('Fecha inválida');
    });

    it('should return error message for invalid date', () => {
      expect(formatDateForDisplay('invalid')).toBe('Fecha inválida');
    });

    it('should respect custom options', () => {
      const date = '2024-06-15T14:30:00.000Z';
      const result = formatDateForDisplay(date, { year: 'numeric' });
      
      expect(result).toContain('2024');
    });
  });

  describe('isDateInPast', () => {
    it('should return true for past date', () => {
      const past = new Date(Date.now() - 86400000); // Yesterday
      expect(isDateInPast(past)).toBe(true);
    });

    it('should return false for future date', () => {
      const future = new Date(Date.now() + 86400000); // Tomorrow
      expect(isDateInPast(future)).toBe(false);
    });

    it('should work with ISO strings', () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      expect(isDateInPast(past)).toBe(true);
    });
  });

  describe('isDateInFuture', () => {
    it('should return true for future date', () => {
      const future = new Date(Date.now() + 86400000); // Tomorrow
      expect(isDateInFuture(future)).toBe(true);
    });

    it('should return false for past date', () => {
      const past = new Date(Date.now() - 86400000); // Yesterday
      expect(isDateInFuture(past)).toBe(false);
    });

    it('should work with ISO strings', () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      expect(isDateInFuture(future)).toBe(true);
    });
  });

  describe('parseIsoDate', () => {
    it('should return null for null input', () => {
      expect(parseIsoDate(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseIsoDate(undefined)).toBeNull();
    });

    it('should return null for invalid date string', () => {
      expect(parseIsoDate('invalid')).toBeNull();
    });

    it('should parse valid ISO string', () => {
      const result = parseIsoDate('2024-06-15T14:30:00.000Z');
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2024);
      expect(result?.getUTCMonth()).toBe(5); // June = 5
      expect(result?.getUTCDate()).toBe(15);
    });

    it('should parse date-only string', () => {
      const result = parseIsoDate('2024-06-15');
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });
  });

  describe('startOfDay', () => {
    it('should return date set to midnight', () => {
      const result = startOfDay('2024-06-15T14:30:00');
      
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should preserve the date', () => {
      const result = startOfDay('2024-06-15T14:30:00');
      
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(5); // June
      expect(result.getDate()).toBe(15);
    });

    it('should work with Date object', () => {
      const input = new Date(2024, 5, 15, 14, 30, 0);
      const result = startOfDay(input);
      
      expect(result.getHours()).toBe(0);
      expect(result.getDate()).toBe(15);
    });
  });

  describe('endOfDay', () => {
    it('should return date set to end of day', () => {
      const result = endOfDay('2024-06-15T14:30:00');
      
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });

    it('should preserve the date', () => {
      const result = endOfDay('2024-06-15T14:30:00');
      
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(15);
    });
  });

  describe('addDuration', () => {
    const baseDate = new Date(2024, 5, 15, 12, 0, 0); // June 15, 2024, 12:00

    it('should add days', () => {
      const result = addDuration(baseDate, { days: 5 });
      
      expect(result.getDate()).toBe(20);
    });

    it('should add hours', () => {
      const result = addDuration(baseDate, { hours: 3 });
      
      expect(result.getHours()).toBe(15);
    });

    it('should add minutes', () => {
      const result = addDuration(baseDate, { minutes: 45 });
      
      expect(result.getMinutes()).toBe(45);
    });

    it('should add seconds', () => {
      const result = addDuration(baseDate, { seconds: 30 });
      
      expect(result.getSeconds()).toBe(30);
    });

    it('should add multiple units', () => {
      const result = addDuration(baseDate, { days: 1, hours: 2, minutes: 30 });
      
      expect(result.getDate()).toBe(16);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it('should handle overflow correctly', () => {
      const result = addDuration(baseDate, { hours: 24 });
      
      expect(result.getDate()).toBe(16);
    });

    it('should work with string input', () => {
      const result = addDuration('2024-06-15T12:00:00', { days: 1 });
      
      expect(result.getDate()).toBe(16);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    it('should format minutes only', () => {
      expect(formatDuration(120)).toBe('2m');
    });

    it('should format minutes and seconds for short durations', () => {
      expect(formatDuration(90)).toBe('1m 30s');
    });

    it('should format hours only', () => {
      expect(formatDuration(3600)).toBe('1h');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(5400)).toBe('1h 30m');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should round seconds', () => {
      expect(formatDuration(45.7)).toBe('46s');
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day', () => {
      const date1 = new Date(2024, 5, 15, 10, 0, 0);
      const date2 = new Date(2024, 5, 15, 18, 0, 0);
      
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different days', () => {
      const date1 = new Date(2024, 5, 15, 10, 0, 0);
      const date2 = new Date(2024, 5, 16, 10, 0, 0);
      
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should return false for different months', () => {
      const date1 = new Date(2024, 5, 15);
      const date2 = new Date(2024, 6, 15);
      
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should return false for different years', () => {
      const date1 = new Date(2024, 5, 15);
      const date2 = new Date(2025, 5, 15);
      
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should work with string inputs', () => {
      expect(isSameDay('2024-06-15T10:00:00', '2024-06-15T18:00:00')).toBe(true);
      expect(isSameDay('2024-06-15T10:00:00', '2024-06-16T10:00:00')).toBe(false);
    });
  });

  describe('getRelativeTime', () => {
    it('should return "hace un momento" for very recent past', () => {
      const recent = new Date(Date.now() - 30000); // 30 seconds ago
      const result = getRelativeTime(recent);
      
      expect(result).toBe('hace un momento');
    });

    it('should return minutes ago for past within hour', () => {
      const minutesAgo = new Date(Date.now() - 300000); // 5 minutes ago
      const result = getRelativeTime(minutesAgo);
      
      expect(result).toMatch(/hace \d+ minutos?/);
    });

    it('should return hours ago for past within day', () => {
      const hoursAgo = new Date(Date.now() - 7200000); // 2 hours ago
      const result = getRelativeTime(hoursAgo);
      
      expect(result).toMatch(/hace \d+ horas?/);
    });

    it('should return days ago for past within month', () => {
      const daysAgo = new Date(Date.now() - 172800000); // 2 days ago
      const result = getRelativeTime(daysAgo);
      
      expect(result).toMatch(/hace \d+ días?/);
    });

    it('should return "ahora" for very near future', () => {
      const soon = new Date(Date.now() + 30000); // 30 seconds from now
      const result = getRelativeTime(soon);
      
      expect(result).toBe('ahora');
    });

    it('should return "en X minutos" for near future', () => {
      const minutesLater = new Date(Date.now() + 300000); // 5 minutes from now
      const result = getRelativeTime(minutesLater);
      
      expect(result).toMatch(/en \d+ minutos?/);
    });

    it('should return "en X horas" for future within day', () => {
      const hoursLater = new Date(Date.now() + 7200000); // 2 hours from now
      const result = getRelativeTime(hoursLater);
      
      expect(result).toMatch(/en \d+ horas?/);
    });

    it('should work with ISO string input', () => {
      const past = new Date(Date.now() - 300000).toISOString();
      const result = getRelativeTime(past);
      
      expect(result).toMatch(/hace \d+ minutos?/);
    });
  });
});
