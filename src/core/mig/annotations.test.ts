import { describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import { addAnnotation, removeAnnotation } from "./annotations"

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
