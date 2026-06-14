import { describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import {
  addConstraint,
  clearConstraintOverrideField,
  clearOverrideField,
  nextConstraintName,
  removeConstraint,
  setConstraintOverrideField,
  setOverrideField,
  updateConstraint,
} from "./overrides"

function mig(
  elementOverrides: MessageImplementationGuide["elementOverrides"] = {}
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
    const next = setOverrideField(mig(), "/Doc/Amt", "definition", "Custom")
    expect(next.elementOverrides).toEqual({
      "/Doc/Amt": { definition: "Custom" },
    })
  })

  it("merges into an existing override, keeping other fields", () => {
    const next = setOverrideField(
      mig({ "/Doc/Amt": { minOccurs: 0 } }),
      "/Doc/Amt",
      "definition",
      "X"
    )
    expect(next.elementOverrides["/Doc/Amt"]).toEqual({
      minOccurs: 0,
      definition: "X",
    })
  })

  it("preserves a tri-state null value", () => {
    const next = setOverrideField(mig(), "/Doc/Amt", "maxLength", null)
    expect("maxLength" in next.elementOverrides["/Doc/Amt"]).toBe(true)
    expect(next.elementOverrides["/Doc/Amt"].maxLength).toBeNull()
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
      mig({ "/Doc/Amt": { definition: "X", minOccurs: 0 } }),
      "/Doc/Amt",
      "definition"
    )
    expect(next.elementOverrides["/Doc/Amt"]).toEqual({ minOccurs: 0 })
  })

  it("prunes the override entry when it becomes empty", () => {
    const next = clearOverrideField(
      mig({ "/Doc/Amt": { definition: "X" } }),
      "/Doc/Amt",
      "definition"
    )
    expect(next.elementOverrides).toEqual({})
  })

  it("is a no-op when the field isn't set", () => {
    const before = mig({ "/Doc/Amt": { minOccurs: 0 } })
    const next = clearOverrideField(before, "/Doc/Amt", "definition")
    expect(next).toBe(before)
  })

  it("does not mutate the input MIG", () => {
    const before = mig({ "/Doc": { definition: "X" } })
    clearOverrideField(before, "/Doc", "definition")
    expect(before.elementOverrides).toEqual({ "/Doc": { definition: "X" } })
  })
})

describe("nextConstraintName", () => {
  it("uses the base name when free", () => {
    expect(nextConstraintName([])).toBe("New constraint")
    expect(nextConstraintName(["Other"])).toBe("New constraint")
  })

  it("suffixes a number to avoid collisions", () => {
    expect(nextConstraintName(["New constraint"])).toBe("New constraint 2")
    expect(nextConstraintName(["New constraint", "New constraint 2"])).toBe(
      "New constraint 3"
    )
  })
})

describe("addConstraint", () => {
  it("creates additionalConstraints on a new path", () => {
    const next = addConstraint(mig(), "/Doc/Amt", {
      name: "Rule A",
      definition: "",
    })
    expect(next.elementOverrides["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "Rule A", definition: "" },
    ])
  })

  it("appends to an existing override, keeping other fields", () => {
    const next = addConstraint(
      mig({ "/Doc/Amt": { minOccurs: 0 } }),
      "/Doc/Amt",
      {
        name: "Rule A",
        definition: "",
      }
    )
    expect(next.elementOverrides["/Doc/Amt"]).toEqual({
      minOccurs: 0,
      additionalConstraints: [{ name: "Rule A", definition: "" }],
    })
  })

  it("is a no-op when a constraint of the same name already exists", () => {
    const before = mig({
      "/Doc/Amt": {
        additionalConstraints: [{ name: "Rule A", definition: "" }],
      },
    })
    const next = addConstraint(before, "/Doc/Amt", {
      name: "Rule A",
      definition: "new",
    })
    expect(next).toBe(before)
  })

  it("does not mutate the input MIG", () => {
    const before = mig()
    addConstraint(before, "Doc", { name: "Rule A", definition: "" })
    expect(before.elementOverrides).toEqual({})
  })
})

describe("updateConstraint", () => {
  const withConstraints = (...names: string[]) =>
    mig({
      "/Doc/Amt": {
        additionalConstraints: names.map((name) => ({ name, definition: "" })),
      },
    })

  it("renames an additional constraint, keeping order", () => {
    const next = updateConstraint(withConstraints("A", "B"), "/Doc/Amt", "A", {
      name: "Z",
    })
    expect(next.elementOverrides["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "Z", definition: "" },
      { name: "B", definition: "" },
    ])
  })

  it("updates the definition", () => {
    const next = updateConstraint(withConstraints("A"), "/Doc/Amt", "A", {
      definition: "Must be set",
    })
    expect(next.elementOverrides["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "A", definition: "Must be set" },
    ])
  })

  it("sets the expression, and prunes an emptied one", () => {
    const set = updateConstraint(withConstraints("A"), "/Doc/Amt", "A", {
      expression: "amt > 0",
    })
    expect(set.elementOverrides["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "A", definition: "", expression: "amt > 0" },
    ])
    const cleared = updateConstraint(set, "/Doc/Amt", "A", { expression: "" })
    expect(cleared.elementOverrides["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "A", definition: "" },
    ])
  })

  it("sets annotation values, and prunes an emptied annotations map", () => {
    const set = updateConstraint(withConstraints("A"), "/Doc/Amt", "A", {
      annotations: { Severity: "high" },
    })
    expect(set.elementOverrides["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "A", definition: "", annotations: { Severity: "high" } },
    ])
    const cleared = updateConstraint(set, "/Doc/Amt", "A", { annotations: {} })
    expect(cleared.elementOverrides["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "A", definition: "" },
    ])
  })

  it("is a no-op when the rename collides with a sibling", () => {
    const before = withConstraints("A", "B")
    expect(updateConstraint(before, "/Doc/Amt", "A", { name: "B" })).toBe(
      before
    )
  })

  it("is a no-op when the constraint or path is absent", () => {
    const before = withConstraints("A")
    expect(updateConstraint(before, "/Doc/Amt", "Missing", { name: "Z" })).toBe(
      before
    )
    expect(updateConstraint(before, "/Doc/Other", "A", { name: "Z" })).toBe(
      before
    )
  })

  it("does not mutate the input MIG", () => {
    const before = withConstraints("A")
    updateConstraint(before, "/Doc/Amt", "A", { name: "Z" })
    expect(before.elementOverrides["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "A", definition: "" },
    ])
  })
})

describe("removeConstraint", () => {
  const withConstraints = (...names: string[]) =>
    mig({
      "/Doc/Amt": {
        additionalConstraints: names.map((name) => ({ name, definition: "" })),
      },
    })

  it("removes one additional constraint, keeping the rest", () => {
    const next = removeConstraint(withConstraints("A", "B"), "/Doc/Amt", "A")
    expect(next.elementOverrides["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "B", definition: "" },
    ])
  })

  it("prunes the empty array but keeps other override fields", () => {
    const before = mig({
      "/Doc/Amt": {
        minOccurs: 0,
        additionalConstraints: [{ name: "A", definition: "" }],
      },
    })
    const next = removeConstraint(before, "/Doc/Amt", "A")
    expect(next.elementOverrides["/Doc/Amt"]).toEqual({ minOccurs: 0 })
  })

  it("prunes the override entry entirely when nothing else remains", () => {
    const next = removeConstraint(withConstraints("A"), "/Doc/Amt", "A")
    expect(next.elementOverrides).toEqual({})
  })

  it("is a no-op when the constraint or path is absent", () => {
    const before = withConstraints("A")
    expect(removeConstraint(before, "/Doc/Amt", "Missing")).toBe(before)
    expect(removeConstraint(before, "/Doc/Other", "A")).toBe(before)
  })

  it("does not mutate the input MIG", () => {
    const before = withConstraints("A")
    removeConstraint(before, "/Doc/Amt", "A")
    expect(before.elementOverrides["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "A", definition: "" },
    ])
  })
})

describe("setConstraintOverrideField / clearConstraintOverrideField", () => {
  it("creates the nested map and entry for a new override", () => {
    const next = setConstraintOverrideField(
      mig(),
      "/Doc/Amt",
      "R1",
      "expression",
      "a > 0"
    )
    expect(next.elementOverrides).toEqual({
      "/Doc/Amt": { constraintOverrides: { R1: { expression: "a > 0" } } },
    })
  })

  it("preserves an explicit null (remove the rule's expression)", () => {
    const next = setConstraintOverrideField(
      mig(),
      "/Doc/Amt",
      "R1",
      "expression",
      null
    )
    expect(next.elementOverrides["/Doc/Amt"].constraintOverrides!.R1).toEqual({
      expression: null,
    })
  })

  it("merges alongside other entries and fields without disturbing them", () => {
    const before = mig({
      "/Doc/Amt": {
        minOccurs: 0,
        constraintOverrides: { R0: { expression: "keep" } },
      },
    })
    const next = setConstraintOverrideField(
      before,
      "/Doc/Amt",
      "R1",
      "expression",
      "x"
    )
    expect(next.elementOverrides["/Doc/Amt"]).toEqual({
      minOccurs: 0,
      constraintOverrides: {
        R0: { expression: "keep" },
        R1: { expression: "x" },
      },
    })
  })

  it("prunes the entry, the map, and the override entry as they empty", () => {
    const before = mig({
      "/Doc/Amt": { constraintOverrides: { R1: { expression: "x" } } },
    })
    const next = clearConstraintOverrideField(
      before,
      "/Doc/Amt",
      "R1",
      "expression"
    )
    expect(next.elementOverrides).toEqual({})
  })

  it("keeps sibling entries and other fields when clearing one", () => {
    const before = mig({
      "/Doc/Amt": {
        minOccurs: 0,
        constraintOverrides: {
          R1: { expression: "x" },
          R2: { expression: "y" },
        },
      },
    })
    const next = clearConstraintOverrideField(
      before,
      "/Doc/Amt",
      "R1",
      "expression"
    )
    expect(next.elementOverrides["/Doc/Amt"]).toEqual({
      minOccurs: 0,
      constraintOverrides: { R2: { expression: "y" } },
    })
  })

  it("is a no-op when the entry or field is absent", () => {
    const before = mig({
      "/Doc/Amt": { constraintOverrides: { R1: { expression: "x" } } },
    })
    expect(
      clearConstraintOverrideField(before, "/Doc/Amt", "Missing", "expression")
    ).toBe(before)
    expect(
      clearConstraintOverrideField(before, "/Doc/Other", "R1", "expression")
    ).toBe(before)
  })
})
