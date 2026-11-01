/**
 * Accepts only same-origin relative paths for post-sign-in redirects, so a
 * crafted `?next=https://evil.example` or `//evil.example` can't bounce users
 * off-site.
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0) return fallback
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback
  return value
}
