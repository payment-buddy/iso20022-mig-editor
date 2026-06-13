import { describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import { addCustomElementPropertyName, removeCustomElementPropertyName } from "./customProperties"

function mig(over: Partial<MessageImplementationGuide> = {}): MessageImplementationGuide {
  return {
    name: "Guide",
    version: "1.0",
    messageIdentifier: "pacs.008.001.10",
    elementOverrides: {},
    ...over,
  }
}

describe("addCustomElementPropertyName", () => {
  it("appends a trimmed name", () => {
    const next = addCustomElementPropertyName(mig(), "  Usage  ")
    expect(next.customElementPropertyNames).toEqual(["Usage"])
  })

  it("ignores blank and duplicate names", () => {
    const base = mig({ customElementPropertyNames: ["Usage"] })
    expect(addCustomElementPropertyName(base, "   ")).toBe(base)
    expect(addCustomElementPropertyName(base, "Usage")).toBe(base)
  })
})

describe("removeCustomElementPropertyName", () => {
  it("removes the name and strips its value from every override", () => {
    const base = mig({
      customElementPropertyNames: ["Usage", "Mandate"],
      elementOverrides: {
        "Doc/Amt": { customProperties: { Usage: "debit", Mandate: "x" } },
        "Doc/Dt": { customProperties: { Usage: "credit" }, minOccurs: 0 },
      },
    })
    const next = removeCustomElementPropertyName(base, "Usage")

    expect(next.customElementPropertyNames).toEqual(["Mandate"])
    expect(next.elementOverrides["Doc/Amt"].customProperties).toEqual({ Mandate: "x" })
    // Dt's customProperties become empty → pruned, but other fields remain.
    expect(next.elementOverrides["Doc/Dt"]).toEqual({ minOccurs: 0 })
  })

  it("prunes an override that becomes empty", () => {
    const base = mig({
      customElementPropertyNames: ["Usage"],
      elementOverrides: { "Doc/Amt": { customProperties: { Usage: "x" } } },
    })
    const next = removeCustomElementPropertyName(base, "Usage")
    expect(next.elementOverrides).toEqual({})
    expect("customElementPropertyNames" in next).toBe(false)
  })

  it("does not mutate the input", () => {
    const base = mig({
      customElementPropertyNames: ["Usage"],
      elementOverrides: { "Doc/Amt": { customProperties: { Usage: "x" } } },
    })
    removeCustomElementPropertyName(base, "Usage")
    expect(base.elementOverrides["Doc/Amt"].customProperties).toEqual({ Usage: "x" })
  })
})
