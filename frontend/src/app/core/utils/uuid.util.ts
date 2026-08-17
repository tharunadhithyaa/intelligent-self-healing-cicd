/**
 * Generates a random UUID (v4 format) compatible with all browser environments,
 * including non-secure HTTP contexts where crypto.randomUUID is restricted or fails.
 */
export function generateUUID(): string {
  // Check if we are in a Secure Context (HTTPS or localhost).
  // Browsers restrict crypto.randomUUID to Secure Contexts only.
  const isSecure = typeof window !== 'undefined' && Boolean(window.isSecureContext);

  if (isSecure && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if crypto.randomUUID throws
    }
  }

  // crypto.getRandomValues IS available in non-secure contexts in Web browsers
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

  // Pure Math.random fallback for legacy/unsupported environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
