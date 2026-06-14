import { describe, expect, it } from "vitest"
import type { ElementOverrides, MessageImplementationGuide } from "@/core/types/types"
import { compareMigs } from "./compareMigs"

function mig(
  overrides: ElementOverrides,
  props: Partial<MessageImplementationGuide> = {},
): MessageImplementationGuide {
  return {
    name: "Test",
    version: "1.0",
    messageIdentifier: "pacs.008.001.08",
    elementOverrides: overrides,
    ...props,
  }
}

describe("compareMigs", () => {
  it("reports no differing paths for identical MIGs", () => {
    const a = mig({ "/Doc/Amt": { maxLength: 18, pattern: "[0-9]+" } })
    const b = mig({ "/Doc/Amt": { maxLength: 18, pattern: "[0-9]+" } })
    expect(compareMigs(a, b).paths).toEqual([])
  })

  it("uses the resolved element name when a resolver is given, else the xmlTag", () => {
    const a = mig({ "/Doc/GrpHdr": { maxLength: 5 } })
    const b = mig({ "/Doc/GrpHdr": { maxLength: 9 } })
    expect(compareMigs(a, b).paths[0].name).toBe("GrpHdr") // xmlTag fallback
    const named = compareMigs(a, b, undefined, (p) =>
      p === "/Doc/GrpHdr" ? "Group Header" : undefined,
    )
    expect(named.paths[0].name).toBe("Group Header")
  })

  it("classifies a changed scalar with both rendered values", () => {
    const a = mig({ "/Doc/Amt": { maxLength: 18 } })
    const b = mig({ "/Doc/Amt": { maxLength: 12 } })
    const { paths } = compareMigs(a, b)
    expect(paths).toHaveLength(1)
    expect(paths[0]).toMatchObject({ path: "/Doc/Amt", name: "Amt", kind: "changed" })
    expect(paths[0].fields).toEqual([
      { label: "Max length", kind: "changed", a: "18", b: "12", ref: { type: "field", field: "maxLength" } },
    ])
  })

  it("classifies a field present in only one MIG as added/removed", () => {
    const a = mig({ "/Doc/Amt": { maxLength: 18 } })
    const b = mig({ "/Doc/Amt": { maxLength: 18, minLength: 1 } })
    const ref = { type: "field", field: "minLength" } as const
    const fields = compareMigs(a, b).paths[0].fields
    expect(fields).toEqual([{ label: "Min length", kind: "added", a: null, b: "1", ref }])

    const reversed = compareMigs(b, a).paths[0].fields
    expect(reversed).toEqual([{ label: "Min length", kind: "removed", a: "1", b: null, ref }])
  })

  it("distinguishes absent (inherit) from null (cleared)", () => {
    // A leaves pattern absent (inherits); B sets it to null (clears the constraint).
    const a = mig({ "/Doc/Amt": {} })
    const b = mig({ "/Doc/Amt": { pattern: null } })
    const fields = compareMigs(a, b).paths[0].fields
    expect(fields).toEqual([
      { label: "Pattern", kind: "added", a: null, b: "cleared", ref: { type: "field", field: "pattern" } },
    ])
  })

  it("does not flag a field both MIGs clear to null", () => {
    const a = mig({ "/Doc/Amt": { pattern: null } })
    const b = mig({ "/Doc/Amt": { pattern: null } })
    expect(compareMigs(a, b).paths).toEqual([])
  })

  it("treats allowedValues as a set (order-insensitive)", () => {
    const a = mig({ "/Doc/Ccy": { allowedValues: ["EUR", "USD"] } })
    const b = mig({ "/Doc/Ccy": { allowedValues: ["USD", "EUR"] } })
    expect(compareMigs(a, b).paths).toEqual([])

    const c = mig({ "/Doc/Ccy": { allowedValues: ["USD", "EUR", "GBP"] } })
    const fields = compareMigs(a, c).paths[0].fields
    expect(fields[0]).toMatchObject({ label: "Allowed values", kind: "changed" })
  })

  it("diffs annotations per name", () => {
    const a = mig({ "/Doc/Amt": { annotations: { Usage: "Required", Note: "x" } } })
    const b = mig({ "/Doc/Amt": { annotations: { Usage: "Optional" } } })
    const fields = compareMigs(a, b).paths[0].fields
    expect(fields).toContainEqual({
      label: "Usage",
      kind: "changed",
      a: "Required",
      b: "Optional",
      ref: { type: "annotation", name: "Usage" },
    })
    expect(fields).toContainEqual({
      label: "Note",
      kind: "removed",
      a: "x",
      b: null,
      ref: { type: "annotation", name: "Note" },
    })
  })

  it("diffs additional constraints per name and ignores identical ones", () => {
    const a = mig({
      "/Doc/Amt": {
        additionalConstraints: [
          { name: "R1", definition: "must be positive" },
          { name: "R2", definition: "kept", expression: "a > 0" },
        ],
      },
    })
    const b = mig({
      "/Doc/Amt": {
        additionalConstraints: [
          { name: "R1", definition: "must be non-negative" },
          { name: "R2", definition: "kept", expression: "a > 0" },
        ],
      },
    })
    const fields = compareMigs(a, b).paths[0].fields
    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({ label: "Constraint “R1”", kind: "changed" })
  })

  it("flags a constraint that differs only by annotation", () => {
    const a = mig({
      "/Doc/Amt": { additionalConstraints: [{ name: "R1", definition: "d", annotations: { S: "1" } }] },
    })
    const b = mig({
      "/Doc/Amt": { additionalConstraints: [{ name: "R1", definition: "d", annotations: { S: "2" } }] },
    })
    const fields = compareMigs(a, b).paths[0].fields
    expect(fields[0]).toMatchObject({ label: "Constraint “R1”", kind: "changed" })
  })

  it("reports a path present in only one MIG", () => {
    const a = mig({ "/Doc/Amt": { maxLength: 18 } })
    const b = mig({ "/Doc/Amt": { maxLength: 18 }, "/Doc/Ccy": { allowedValues: ["EUR"] } })
    const { paths } = compareMigs(a, b)
    expect(paths).toHaveLength(1)
    expect(paths[0]).toMatchObject({ path: "/Doc/Ccy", kind: "added" })
    expect(paths[0].fields).toEqual([
      { label: "Allowed values", kind: "added", a: null, b: "EUR", ref: { type: "field", field: "allowedValues" } },
    ])
  })

  it("orders paths by the supplied schema-order map, unknowns last alphabetically", () => {
    const a = mig({ "/Doc/Z": { maxLength: 1 }, "/Doc/A": { maxLength: 1 }, "/Doc/Orphan": { maxLength: 1 } })
    const b = mig({ "/Doc/Z": { maxLength: 2 }, "/Doc/A": { maxLength: 2 }, "/Doc/Orphan": { maxLength: 2 } })
    const order = new Map([
      ["/Doc/Z", 0],
      ["/Doc/A", 1],
    ])
    const paths = compareMigs(a, b, order).paths.map((p) => p.path)
    expect(paths).toEqual(["/Doc/Z", "/Doc/A", "/Doc/Orphan"])
  })

  it("treats same-family (same short code) MIGs as the same message", () => {
    const v8 = mig({}, { messageIdentifier: "pacs.008.001.08" })
    const v9 = mig({}, { messageIdentifier: "pacs.008.001.09" })
    expect(compareMigs(v8, v9).sameMessage).toBe(true)
  })

  it("flags a cross-family comparison (different short code)", () => {
    const a = mig({}, { messageIdentifier: "pacs.008.001.08" })
    const b = mig({}, { messageIdentifier: "pacs.009.001.08" })
    expect(compareMigs(a, b).sameMessage).toBe(false)
  })

  it("renders definition edge cases (empty vs cleared)", () => {
    const a = mig({ "/Doc/Amt": { definition: "" } })
    const b = mig({ "/Doc/Amt": { definition: null } })
    const fields = compareMigs(a, b).paths[0].fields
    expect(fields).toEqual([
      { label: "Definition", kind: "changed", a: "(empty)", b: "cleared", ref: { type: "field", field: "definition" } },
    ])
  })
})
