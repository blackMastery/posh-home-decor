/**
 * Product names as shown on the storefront: Title Case regardless of how they
 * were typed ("STOWE TRAY 12\"X 2\"" → "Stowe Tray 12\"x 2\""). Stored names are untouched.
 */
export function displayName(name: string) {
  return name.toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
