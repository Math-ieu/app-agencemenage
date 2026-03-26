/* ═══════════════════════════════════════════════════════════
   ID Obfuscation Utility
   Provides simple "security by obscurity" for URL parameters.
   ═══════════════════════════════════════════════════════════ */

const SALT = "am_secure_2026";

/**
 * Encodes a numeric ID into an obfuscated string for use in URLs.
 */
export function encodeId(id: number | string): string {
  const str = `${id}:${SALT}`;
  // Basic Base64 encoding with URL-safe replacements
  return btoa(str)
    .replace(/=/g, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
}

/**
 * Decodes an obfuscated string back into a numeric ID.
 * Returns null if the code is invalid or the salt doesn't match.
 */
export function decodeId(code: string | undefined): number | null {
  if (!code) return null;
  try {
    // Revert URL-safe replacements
    const normalized = code.replace(/_/g, '/').replace(/-/g, '+');
    // Pad with '=' if necessary to restore valid Base64
    const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=');
    const decoded = atob(padded);
    const [idStr, salt] = decoded.split(':');
    
    if (salt === SALT && idStr) {
      const id = parseInt(idStr);
      return isNaN(id) ? null : id;
    }
    return null;
  } catch (err) {
    return null;
  }
}
