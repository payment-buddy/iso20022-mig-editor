import { describe, expect, it } from "vitest"
import type {
  ElementOverrides,
  MessageImplementationGuide,
} from "@/core/types/types"
import { applyFieldCopy } from "./copyChange"

function mig(
  overrides: ElementOverrides,
  name = "M"
): MessageImplementationGuide {
  return {
    name,
    version: "1.0",
    messageIdentifier: "pacs.008.001.08",
    elementOverrides: overrides,
  }
}

const P = "/Doc/Amt"

describe("applyFieldCopy — scalar fields", () => {
  it("copies a declared value into the target", () => {
    const src = mig({ [P]: { maxLength: 12 } })
    const tgt = mig({ [P]: { maxLength: 18 } })
    const next = applyFieldCopy(src, tgt, P, {
      type: "field",
      field: "maxLength",
    })
    expect(next.elementOverrides[P].maxLength).toBe(12)
  })

  it("clears the target field when the source inherits (field absent)", () => {
    const src = mig({ [P]: { minLength: 1 } }) // no maxLength → inherits
    const tgt = mig({ [P]: { maxLength: 18, minLength: 1 } })
    const next = applyFieldCopy(src, tgt, P, {
      type: "field",
      field: "maxLength",
    })
    expect("maxLength" in next.elementOverrides[P]).toBe(false)
    expect(next.elementOverrides[P].minLength).toBe(1)
  })

  it("copies a null (cleared) value verbatim rather than collapsing to inherit", () => {
    const src = mig({ [P]: { pattern: null } })
    const tgt = mig({ [P]: { pattern: "[0-9]+" } })
    const next = applyFieldCopy(src, tgt, P, {
      type: "field",
      field: "pattern",
    })
    expect("pattern" in next.elementOverrides[P]).toBe(true)
    expect(next.elementOverrides[P].pattern).toBeNull()
  })

  it("prunes the path entry when clearing its only field", () => {
    const src = mig({}) // source has no override at P → inherits
    const tgt = mig({ [P]: { maxLength: 18 } })
    const next = applyFieldCopy(src, tgt, P, {
      type: "field",
      field: "maxLength",
    })
    expect(P in next.elementOverrides).toBe(false)
  })

  it("copies array fields (allowedValues)", () => {
    const src = mig({ [P]: { allowedValues: ["EUR", "USD"] } })
    const tgt = mig({ [P]: {} })
    const next = applyFieldCopy(src, tgt, P, {
      type: "field",
      field: "allowedValues",
    })
    expect(next.elementOverrides[P].allowedValues).toEqual(["EUR", "USD"])
  })

  it("does not mutate source or target", () => {
    const src = mig({ [P]: { maxLength: 12 } })
    const tgt = mig({ [P]: { maxLength: 18 } })
    applyFieldCopy(src, tgt, P, { type: "field", field: "maxLength" })
    expect(src.elementOverrides[P].maxLength).toBe(12)
    expect(tgt.elementOverrides[P].maxLength).toBe(18)
  })
})

describe("applyFieldCopy — annotations", () => {
  it("sets one annotation, leaving the target's others intact", () => {
    const src = mig({ [P]: { annotations: { Usage: "Required" } } })
    const tgt = mig({
      [P]: { annotations: { Usage: "Optional", Note: "keep" } },
    })
    const next = applyFieldCopy(src, tgt, P, {
      type: "annotation",
      name: "Usage",
    })
    expect(next.elementOverrides[P].annotations).toEqual({
      Usage: "Required",
      Note: "keep",
    })
  })

  it("removes an annotation absent in the source", () => {
    const src = mig({ [P]: { annotations: {} } })
    const tgt = mig({
      [P]: { annotations: { Usage: "Optional", Note: "keep" } },
    })
    const next = applyFieldCopy(src, tgt, P, {
      type: "annotation",
      name: "Usage",
    })
    expect(next.elementOverrides[P].annotations).toEqual({ Note: "keep" })
  })

  it("clears the annotations field when the last entry is removed", () => {
    const src = mig({ [P]: {} })
    const tgt = mig({
      [P]: { maxLength: 18, annotations: { Usage: "Optional" } },
    })
    const next = applyFieldCopy(src, tgt, P, {
      type: "annotation",
      name: "Usage",
    })
    expect("annotations" in next.elementOverrides[P]).toBe(false)
    expect(next.elementOverrides[P].maxLength).toBe(18)
  })
})

describe("applyFieldCopy — additional constraints", () => {
  it("adds a constraint the target lacks", () => {
    const src = mig({
      [P]: { additionalConstraints: [{ name: "R1", definition: "positive" }] },
    })
    const tgt = mig({ [P]: {} })
    const next = applyFieldCopy(src, tgt, P, { type: "constraint", name: "R1" })
    expect(next.elementOverrides[P].additionalConstraints).toEqual([
      { name: "R1", definition: "positive" },
    ])
  })

  it("overwrites an existing constraint to mirror the source", () => {
    const src = mig({
      [P]: {
        additionalConstraints: [
          { name: "R1", definition: "non-negative", expression: "a>=0" },
        ],
      },
    })
    const tgt = mig({
      [P]: {
        additionalConstraints: [
          { name: "R1", definition: "positive", annotations: { S: "1" } },
        ],
      },
    })
    const next = applyFieldCopy(src, tgt, P, { type: "constraint", name: "R1" })
    const c = next.elementOverrides[P].additionalConstraints![0]
    expect(c).toEqual({
      name: "R1",
      definition: "non-negative",
      expression: "a>=0",
    })
  })

  it("removes a constraint absent in the source", () => {
    const src = mig({ [P]: {} })
    const tgt = mig({
      [P]: { additionalConstraints: [{ name: "R1", definition: "x" }] },
    })
    const next = applyFieldCopy(src, tgt, P, { type: "constraint", name: "R1" })
    expect(P in next.elementOverrides).toBe(false)
  })
})
