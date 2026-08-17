import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateUUID } from './uuid.util';

describe('generateUUID', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalCrypto) {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        writable: true,
        configurable: true,
      });
    }
  });

  it('should generate a valid RFC4122 v4 UUID string', () => {
    const uuid = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it('should use crypto.randomUUID when available and working', () => {
    const mockUUID = '12345678-1234-4234-8234-123456789abc';
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => mockUUID,
        getRandomValues: (arr: Uint8Array) => arr,
      },
      writable: true,
      configurable: true,
    });

    const result = generateUUID();
    expect(result).toBe(mockUUID);
  });

  it('should fallback to getRandomValues when crypto.randomUUID throws', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => {
          throw new Error('Restricted in HTTP non-secure context');
        },
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = i * 16;
          return arr;
        },
      },
      writable: true,
      configurable: true,
    });

    const result = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(result).toMatch(uuidRegex);
  });
});
