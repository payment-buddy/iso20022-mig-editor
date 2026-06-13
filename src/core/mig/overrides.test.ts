import { describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import {
  addConstraint,
  clearOverrideField,
  nextConstraintName,
  setOverrideField,
} from "./overrides"

function mig(
  elementOverrides: MessageImplementationGuide["elementOverrides"] = {},
): MessageImplementationGuide {
  return {
    name: "Guide",
    version: "1.0",
    messageIdentifier: "pacs.008.001.10",
    elementOverrides,
  }
}

describe("setOverrideField", () => {
  it("creates an override entry for a new path", () => {
    const next = setOverrideField(mig(), "Doc/Amt", "definition", "Custom")
    expect(next.elementOverrides).toEqual({ "Doc/Amt": { definition: "Custom" } })
  })

  it("merges into an existing override, keeping other fields", () => {
    const next = setOverrideField(mig({ "Doc/Amt": { minOccurs: 0 } }), "Doc/Amt", "definition", "X")
    expect(next.elementOverrides["Doc/Amt"]).toEqual({ minOccurs: 0, definition: "X" })
  })

  it("preserves a tri-state null value", () => {
    const next = setOverrideField(mig(), "Doc/Amt", "maxLength", null)
    expect("maxLength" in next.elementOverrides["Doc/Amt"]).toBe(true)
    expect(next.elementOverrides["Doc/Amt"].maxLength).toBeNull()
  })

  it("does not mutate the input MIG", () => {
    const before = mig()
    setOverrideField(before, "Doc", "definition", "X")
    expect(before.elementOverrides).toEqual({})
  })
})

describe("clearOverrideField", () => {
  it("removes a single field but keeps the rest of the override", () => {
    const next = clearOverrideField(
      mig({ "Doc/Amt": { definition: "X", minOccurs: 0 } }),
      "Doc/Amt",
      "definition",
    )
    expect(next.elementOverrides["Doc/Amt"]).toEqual({ minOccurs: 0 })
  })

  it("prunes the override entry when it becomes empty", () => {
    const next = clearOverrideField(mig({ "Doc/Amt": { definition: "X" } }), "Doc/Amt", "definition")
    expect(next.elementOverrides).toEqual({})
  })

  it("is a no-op when the field isn't set", () => {
    const before = mig({ "Doc/Amt": { minOccurs: 0 } })
    const next = clearOverrideField(before, "Doc/Amt", "definition")
    expect(next).toBe(before)
  })

  it("does not mutate the input MIG", () => {
    const before = mig({ "Doc": { definition: "X" } })
    clearOverrideField(before, "Doc", "definition")
    expect(before.elementOverrides).toEqual({ Doc: { definition: "X" } })
  })
})

describe("nextConstraintName", () => {
  it("uses the base name when free", () => {
    expect(nextConstraintName([])).toBe("New constraint")
    expect(nextConstraintName(["Other"])).toBe("New constraint")
  })

  it("suffixes a number to avoid collisions", () => {
    expect(nextConstraintName(["New constraint"])).toBe("New constraint 2")
    expect(nextConstraintName(["New constraint", "New constraint 2"])).toBe("New constraint 3")
  })
})

describe("addConstraint", () => {
  it("creates additionalConstraints on a new path", () => {
    const next = addConstraint(mig(), "Doc/Amt", { name: "Rule A", definition: "" })
    expect(next.elementOverrides["Doc/Amt"].additionalConstraints).toEqual([
      { name: "Rule A", definition: "" },
    ])
  })

  it("appends to an existing override, keeping other fields", () => {
    const next = addConstraint(mig({ "Doc/Amt": { minOccurs: 0 } }), "Doc/Amt", {
      name: "Rule A",
      definition: "",
    })
    expect(next.elementOverrides["Doc/Amt"]).toEqual({
      minOccurs: 0,
      additionalConstraints: [{ name: "Rule A", definition: "" }],
    })
  })

  it("is a no-op when a constraint of the same name already exists", () => {
    const before = mig({ "Doc/Amt": { additionalConstraints: [{ name: "Rule A", definition: "" }] } })
    const next = addConstraint(before, "Doc/Amt", { name: "Rule A", definition: "new" })
    expect(next).toBe(before)
  })

  it("does not mutate the input MIG", () => {
    const before = mig()
    addConstraint(before, "Doc", { name: "Rule A", definition: "" })
    expect(before.elementOverrides).toEqual({})
  })
})
