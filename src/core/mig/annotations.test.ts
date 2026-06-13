import { describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import {
  addAnnotation,
  addConstraintAnnotation,
  removeAnnotation,
  removeConstraintAnnotation,
} from "./annotations"

function mig(over: Partial<MessageImplementationGuide> = {}): MessageImplementationGuide {
  return {
    name: "Guide",
    version: "1.0",
    messageIdentifier: "pacs.008.001.10",
    elementOverrides: {},
    ...over,
  }
}

describe("addAnnotation", () => {
  it("appends a trimmed name", () => {
    const next = addAnnotation(mig(), "  Usage  ")
    expect(next.elementAnnotationNames).toEqual(["Usage"])
  })

  it("ignores blank and duplicate names", () => {
    const base = mig({ elementAnnotationNames: ["Usage"] })
    expect(addAnnotation(base, "   ")).toBe(base)
    expect(addAnnotation(base, "Usage")).toBe(base)
  })
})

describe("removeAnnotation", () => {
  it("removes the name and strips its value from every override", () => {
    const base = mig({
      elementAnnotationNames: ["Usage", "Mandate"],
      elementOverrides: {
        "Doc/Amt": { annotations: { Usage: "debit", Mandate: "x" } },
        "Doc/Dt": { annotations: { Usage: "credit" }, minOccurs: 0 },
      },
    })
    const next = removeAnnotation(base, "Usage")

    expect(next.elementAnnotationNames).toEqual(["Mandate"])
    expect(next.elementOverrides["Doc/Amt"].annotations).toEqual({ Mandate: "x" })
    // Dt's annotations become empty → pruned, but other fields remain.
    expect(next.elementOverrides["Doc/Dt"]).toEqual({ minOccurs: 0 })
  })

  it("prunes an override that becomes empty", () => {
    const base = mig({
      elementAnnotationNames: ["Usage"],
      elementOverrides: { "Doc/Amt": { annotations: { Usage: "x" } } },
    })
    const next = removeAnnotation(base, "Usage")
    expect(next.elementOverrides).toEqual({})
    expect("elementAnnotationNames" in next).toBe(false)
  })

  it("does not mutate the input", () => {
    const base = mig({
      elementAnnotationNames: ["Usage"],
      elementOverrides: { "Doc/Amt": { annotations: { Usage: "x" } } },
    })
    removeAnnotation(base, "Usage")
    expect(base.elementOverrides["Doc/Amt"].annotations).toEqual({ Usage: "x" })
  })
})

describe("addConstraintAnnotation", () => {
  it("appends a trimmed name to the constraint list", () => {
    const next = addConstraintAnnotation(mig(), "  Severity  ")
    expect(next.constraintAnnotationNames).toEqual(["Severity"])
    // Leaves the element list untouched.
    expect(next.elementAnnotationNames).toBeUndefined()
  })

  it("ignores blank and duplicate names", () => {
    const base = mig({ constraintAnnotationNames: ["Severity"] })
    expect(addConstraintAnnotation(base, "   ")).toBe(base)
    expect(addConstraintAnnotation(base, "Severity")).toBe(base)
  })
})

describe("removeConstraintAnnotation", () => {
  it("removes the name and strips its value from every additional constraint", () => {
    const base = mig({
      constraintAnnotationNames: ["Severity", "Owner"],
      elementOverrides: {
        "Doc/Amt": {
          additionalConstraints: [
            { name: "Rule A", definition: "", annotations: { Severity: "high", Owner: "x" } },
            { name: "Rule B", definition: "", annotations: { Severity: "low" } },
          ],
        },
      },
    })
    const next = removeConstraintAnnotation(base, "Severity")

    expect(next.constraintAnnotationNames).toEqual(["Owner"])
    const list = next.elementOverrides["Doc/Amt"].additionalConstraints
    expect(list?.[0].annotations).toEqual({ Owner: "x" })
    // Rule B's annotations become empty → pruned, the constraint stays.
    expect(list?.[1]).toEqual({ name: "Rule B", definition: "" })
  })

  it("drops the names list when it empties, leaving constraints in place", () => {
    const base = mig({
      constraintAnnotationNames: ["Severity"],
      elementOverrides: {
        "Doc/Amt": {
          additionalConstraints: [{ name: "Rule A", definition: "", annotations: { Severity: "x" } }],
        },
      },
    })
    const next = removeConstraintAnnotation(base, "Severity")
    expect("constraintAnnotationNames" in next).toBe(false)
    expect(next.elementOverrides["Doc/Amt"].additionalConstraints).toEqual([
      { name: "Rule A", definition: "" },
    ])
  })

  it("does not mutate the input", () => {
    const base = mig({
      constraintAnnotationNames: ["Severity"],
      elementOverrides: {
        "Doc/Amt": {
          additionalConstraints: [{ name: "Rule A", definition: "", annotations: { Severity: "x" } }],
        },
      },
    })
    removeConstraintAnnotation(base, "Severity")
    expect(base.elementOverrides["Doc/Amt"].additionalConstraints?.[0].annotations).toEqual({
      Severity: "x",
    })
  })
})
