import { describe, expect, it } from "vitest"
import { safeRedirectPath } from "./safe-redirect"

describe("safeRedirectPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeRedirectPath("/account/appointments?tab=past")).toBe("/account/appointments?tab=past")
  })

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", undefined, 42])(
    "rejects %s",
    (value) => {
      expect(safeRedirectPath(value, "/fallback")).toBe("/fallback")
    }
  )
})
