import { describe, expect, it } from "vitest"
import { validateMigImport } from "./validateMigImport"

const base = {
  name: "EPC",
  version: "1.0",
  messageIdentifier: "pacs.008.001.08",
  elementOverrides: {},
}

describe("validateMigImport", () => {
  it("accepts a minimal valid MIG", () => {
    expect(validateMigImport(base)).toEqual({ ok: true, mig: base })
  })

  it("accepts tri-state null facets and additional constraints", () => {
    const mig = {
      ...base,
      elementOverrides: {
        "/Doc/Amt": {
          maxLength: null,
          additionalConstraints: { R: { definition: "" } },
        },
      },
    }
    expect(validateMigImport(mig)).toEqual({ ok: true, mig })
  })

  it("accepts constraintOverrides with a tri-state expression", () => {
    const mig = {
      ...base,
      elementOverrides: {
        "/Doc/Amt": {
          constraintOverrides: {
            R1: { expression: "a > 0" },
            R2: { expression: null },
          },
        },
      },
    }
    expect(validateMigImport(mig)).toEqual({ ok: true, mig })
  })

  it("strips unknown keys such as formatVersion", () => {
    const result = validateMigImport({ formatVersion: 1, ...base })
    expect(result.ok && result.mig).toEqual(base)
  })

  it("rejects missing required fields with readable errors", () => {
    const result = validateMigImport({ name: "EPC", elementOverrides: {} })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join("\n")).toMatch(/version/i)
    expect(result.errors.join("\n")).toMatch(/messageIdentifier/i)
  })

  it("reports the path of a wrongly typed override facet", () => {
    const result = validateMigImport({
      ...base,
      elementOverrides: { "/Doc/Amt": { maxLength: "thirty" } },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toMatch(/elementOverrides\.\/Doc\/Amt\.maxLength/)
  })

  it("rejects non-objects", () => {
    expect(validateMigImport("nope").ok).toBe(false)
    expect(validateMigImport(null).ok).toBe(false)
    expect(validateMigImport(42).ok).toBe(false)
  })
})
