/**
 * Generates a standard UUID (v4 format) for non-security-sensitive UI and component identifiers.
 *
 * Primary: Uses `crypto.randomUUID()` in Secure Contexts (HTTPS / localhost).
 * Secondary: Uses `crypto.getRandomValues()` for non-secure HTTP contexts.
 * Fallback: Uses `Math.trunc(Math.random() * 16)` for legacy or restricted environments.
 *
 * @security Intended ONLY for client-side UI correlation, DOM IDs, chart gradient IDs, and component identifiers.
 *           Do NOT use for cryptographic key generation, authentication tokens, or security decisions.
 *
 * @returns A 36-character RFC4122 v4 compliant UUID string.
 */
export function generateUUID(): string {
  // Check if running in a Secure Context (HTTPS/localhost)
  const isSecure = typeof window !== 'undefined' && Boolean(window.isSecureContext);

  if (isSecure && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if crypto.randomUUID fails
    }
  }

  // Web Crypto API getRandomValues is available in non-secure HTTP contexts in modern browsers
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 1 (RFC4122)
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // Fallback if getRandomValues fails
    }
  }

  // Non-security pseudorandom fallback using Math.trunc (eliminates bitwise operators)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const randomVal = c === 'x' ? Math.random() * 16 : Math.random() * 4 + 8;
    return Math.trunc(randomVal).toString(16);
  });
}
