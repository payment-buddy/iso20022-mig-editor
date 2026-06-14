import { describe, expect, it } from "vitest"
import { formatLocalDateTime } from "./datetime"

describe("formatLocalDateTime", () => {
  it("formats as local YYYY-MM-DD HH:mm:ss with a space separator", () => {
    expect(formatLocalDateTime(1_700_000_000_000)).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    )
  })

  it("zero-pads single-digit fields", () => {
    // 2000-01-02 03:04:05 local time.
    const at = new Date(2000, 0, 2, 3, 4, 5).getTime()
    expect(formatLocalDateTime(at)).toBe("2000-01-02 03:04:05")
  })
})
