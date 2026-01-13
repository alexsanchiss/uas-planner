/**
 * Unit tests for auth utilities
 * 
 * TASK-206: Test auth utilities (lib/auth.ts)
 */

// Mock environment variable before importing auth module
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

import {
  hashPassword,
  comparePasswords,
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  decodeToken,
  isTokenExpiringSoon,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_MS,
} from '../auth';

describe('Auth Utilities', () => {
  describe('Constants', () => {
    it('should have correct access token expiry', () => {
      expect(ACCESS_TOKEN_EXPIRY).toBe('15m');
    });

    it('should have correct refresh token expiry', () => {
      expect(REFRESH_TOKEN_EXPIRY).toBe('7d');
    });

    it('should have correct refresh token expiry in milliseconds', () => {
      expect(REFRESH_TOKEN_EXPIRY_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('Password Hashing', () => {
    const testPassword = 'MySecurePassword123!';

    it('should hash a password', async () => {
      const hashed = await hashPassword(testPassword);
      
      expect(hashed).toBeDefined();
      expect(typeof hashed).toBe('string');
      expect(hashed).not.toBe(testPassword);
      expect(hashed.length).toBeGreaterThan(50); // bcrypt hashes are ~60 chars
    });

    it('should generate different hashes for the same password', async () => {
      const hash1 = await hashPassword(testPassword);
      const hash2 = await hashPassword(testPassword);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should verify correct password', async () => {
      const hashed = await hashPassword(testPassword);
      const isValid = await comparePasswords(testPassword, hashed);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hashed = await hashPassword(testPassword);
      const isValid = await comparePasswords('WrongPassword', hashed);
      
      expect(isValid).toBe(false);
    });

    it('should handle empty password', async () => {
      const hashed = await hashPassword('');
      const isValid = await comparePasswords('', hashed);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Access Token Generation and Verification', () => {
    const testUserId = 12345;

    it('should generate a valid access token', () => {
      const token = generateToken(testUserId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should verify a valid access token', () => {
      const token = generateToken(testUserId);
      const decoded = verifyToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(testUserId);
    });

    it('should return null for invalid token', () => {
      const decoded = verifyToken('invalid.token.here');
      
      expect(decoded).toBeNull();
    });

    it('should return null for tampered token', () => {
      const token = generateToken(testUserId);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      const decoded = verifyToken(tamperedToken);
      
      expect(decoded).toBeNull();
    });

    it('should return null for empty token', () => {
      const decoded = verifyToken('');
      
      expect(decoded).toBeNull();
    });
  });

  describe('Refresh Token Generation and Verification', () => {
    const testUserId = 67890;

    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(testUserId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(testUserId);
      const decoded = verifyRefreshToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(testUserId);
    });

    it('should not verify access token as refresh token', () => {
      const accessToken = generateToken(testUserId);
      const decoded = verifyRefreshToken(accessToken);
      
      expect(decoded).toBeNull();
    });

    it('should not verify refresh token as access token', () => {
      const refreshToken = generateRefreshToken(testUserId);
      const decoded = verifyToken(refreshToken);
      
      expect(decoded).toBeNull();
    });

    it('should return null for invalid refresh token', () => {
      const decoded = verifyRefreshToken('invalid.refresh.token');
      
      expect(decoded).toBeNull();
    });
  });

  describe('Token Decoding', () => {
    const testUserId = 11111;

    it('should decode a valid token', () => {
      const token = generateToken(testUserId);
      const decoded = decodeToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(testUserId);
      expect(decoded?.type).toBe('access');
      expect(decoded?.exp).toBeDefined();
      expect(decoded?.iat).toBeDefined();
    });

    it('should return null for malformed token', () => {
      const decoded = decodeToken('not-a-jwt');
      
      expect(decoded).toBeNull();
    });
  });

  describe('Token Expiration Check', () => {
    const testUserId = 22222;

    it('should return false for freshly generated token', () => {
      const token = generateToken(testUserId);
      const isExpiring = isTokenExpiringSoon(token);
      
      // Fresh token should not be expiring soon
      expect(isExpiring).toBe(false);
    });

    it('should return true for invalid token', () => {
      const isExpiring = isTokenExpiringSoon('invalid.token');
      
      expect(isExpiring).toBe(true);
    });

    it('should return true for token without exp', () => {
      // This would require a token without exp claim, which our generateToken always includes
      // So we test with a malformed token that can't be decoded
      const isExpiring = isTokenExpiringSoon('');
      
      expect(isExpiring).toBe(true);
    });
  });

  describe('Token Uniqueness', () => {
    const testUserId = 33333;

    it('should generate tokens with same user info when called quickly', () => {
      // When called within the same second, tokens will be identical
      // because iat (issued at) has 1-second resolution
      const token1 = generateToken(testUserId);
      const token2 = generateToken(testUserId);
      
      // Both should be valid and contain same userId
      const decoded1 = verifyToken(token1);
      const decoded2 = verifyToken(token2);
      expect(decoded1?.userId).toBe(testUserId);
      expect(decoded2?.userId).toBe(testUserId);
    });

    it('should generate different tokens for different users', () => {
      const token1 = generateToken(testUserId);
      const token2 = generateToken(testUserId + 1);
      
      // Different users = different tokens
      expect(token1).not.toBe(token2);
      
      const decoded1 = verifyToken(token1);
      const decoded2 = verifyToken(token2);
      expect(decoded1?.userId).toBe(testUserId);
      expect(decoded2?.userId).toBe(testUserId + 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle userId of 0', () => {
      const token = generateToken(0);
      const decoded = verifyToken(token);
      
      expect(decoded?.userId).toBe(0);
    });

    it('should handle large userId', () => {
      const largeId = 9999999999;
      const token = generateToken(largeId);
      const decoded = verifyToken(token);
      
      expect(decoded?.userId).toBe(largeId);
    });

    it('should handle negative userId', () => {
      const negativeId = -123;
      const token = generateToken(negativeId);
      const decoded = verifyToken(token);
      
      expect(decoded?.userId).toBe(negativeId);
    });
  });
});
