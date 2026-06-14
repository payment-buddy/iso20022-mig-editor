import { describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import { effectiveMig, mergeOverrides, resolveParentChain } from "./effectiveMig"

function mig(
  name: string,
  over: Partial<MessageImplementationGuide> = {},
): MessageImplementationGuide {
  return {
    name,
    version: "1",
    messageIdentifier: "pacs.008.001.08",
    elementOverrides: {},
    ...over,
  }
}

describe("resolveParentChain", () => {
  it("orders the chain ancestor-first … leaf-last", () => {
    const gp = mig("GP")
    const parent = mig("P", { parentMIG: "GP:1" })
    const leaf = mig("L", { parentMIG: "P:1" })
    const { chain, missingParent } = resolveParentChain(leaf, [leaf, parent, gp])
    expect(chain.map((m) => m.name)).toEqual(["GP", "P", "L"])
    expect(missingParent).toBeUndefined()
  })

  it("flags an unresolved parent and stops below it", () => {
    const leaf = mig("L", { parentMIG: "Missing:9" })
    const { chain, missingParent } = resolveParentChain(leaf, [leaf])
    expect(chain.map((m) => m.name)).toEqual(["L"])
    expect(missingParent).toBe("Missing:9")
  })

  it("does not loop on a cycle", () => {
    const a = mig("A", { parentMIG: "B:1" })
    const b = mig("B", { parentMIG: "A:1" })
    const { chain } = resolveParentChain(a, [a, b])
    expect(chain.map((m) => m.name)).toEqual(["B", "A"])
  })
})

describe("mergeOverrides (key-presence, tri-state)", () => {
  const chainOf = (...overrides: MessageImplementationGuide["elementOverrides"][]) =>
    overrides.map((o, i) => mig(`M${i}`, { elementOverrides: o }))

  it("lets a descendant value win, and inherits when the descendant is silent", () => {
    const merged = mergeOverrides(
      chainOf(
        { "/Doc/Amt": { maxLength: 35, minOccurs: 1 } },
        { "/Doc/Amt": { maxLength: 10 } }, // overrides maxLength, inherits minOccurs
      ),
    )
    expect(merged["/Doc/Amt"]).toEqual({ maxLength: 10, minOccurs: 1 })
  })

  it("preserves a descendant null over an ancestor value (remove the constraint)", () => {
    const merged = mergeOverrides(
      chainOf({ "/Doc/Amt": { maxLength: 35 } }, { "/Doc/Amt": { maxLength: null } }),
    )
    expect("maxLength" in merged["/Doc/Amt"]).toBe(true)
    expect(merged["/Doc/Amt"].maxLength).toBeNull()
  })

  it("unions overrides at different paths", () => {
    const merged = mergeOverrides(
      chainOf({ "/Doc/A": { minOccurs: 0 } }, { "/Doc/B": { minOccurs: 0 } }),
    )
    expect(Object.keys(merged).sort()).toEqual(["/Doc/A", "/Doc/B"])
  })

  it("accumulates annotation values per name (leaf wins on a clash)", () => {
    const merged = mergeOverrides(
      chainOf(
        { "/Doc/Amt": { annotations: { Owner: "ops", Usage: "old" } } },
        { "/Doc/Amt": { annotations: { Usage: "new" } } },
      ),
    )
    expect(merged["/Doc/Amt"].annotations).toEqual({ Owner: "ops", Usage: "new" })
  })

  it("unions additional constraints by name (leaf wins on a clash)", () => {
    const merged = mergeOverrides(
      chainOf(
        { "/Doc/Amt": { additionalConstraints: [{ name: "A", definition: "base" }] } },
        {
          "/Doc/Amt": {
            additionalConstraints: [
              { name: "A", definition: "override" },
              { name: "B", definition: "new" },
            ],
          },
        },
      ),
    )
    expect(merged["/Doc/Amt"].additionalConstraints).toEqual([
      { name: "A", definition: "override" },
      { name: "B", definition: "new" },
    ])
  })

  it("prunes a path whose merged override is empty", () => {
    expect(mergeOverrides(chainOf({ "/Doc/Amt": {} }))).toEqual({})
  })

  it("merges constraintOverrides by name, the leaf field winning by key-presence", () => {
    const merged = mergeOverrides(
      chainOf(
        { "/Doc/Amt": { constraintOverrides: { R1: { expression: "a > 0" } } } },
        { "/Doc/Amt": { constraintOverrides: { R1: { expression: null }, R2: { expression: "b" } } } },
      ),
    )
    expect("expression" in merged["/Doc/Amt"].constraintOverrides!.R1).toBe(true)
    expect(merged["/Doc/Amt"].constraintOverrides).toEqual({
      R1: { expression: null },
      R2: { expression: "b" },
    })
  })
})

describe("effectiveMig", () => {
  it("flattens identity, overrides and annotation names; drops parentMIG", () => {
    const parent = mig("P", {
      elementAnnotationNames: ["Owner"],
      elementOverrides: { "/Doc/Amt": { maxLength: 35 } },
    })
    const leaf = mig("L", {
      parentMIG: "P:1",
      description: "Leaf guide",
      elementAnnotationNames: ["Usage"],
      elementOverrides: { "/Doc/Amt": { maxLength: 10 } },
    })
    const { mig: eff, chain, missingParent } = effectiveMig(leaf, [leaf, parent])

    expect(missingParent).toBeUndefined()
    expect(chain.map((m) => m.name)).toEqual(["P", "L"])
    expect(eff).toEqual({
      name: "L",
      version: "1",
      messageIdentifier: "pacs.008.001.08",
      description: "Leaf guide",
      elementAnnotationNames: ["Owner", "Usage"], // union, ancestor-first
      elementOverrides: { "/Doc/Amt": { maxLength: 10 } },
    })
    expect("parentMIG" in eff).toBe(false)
  })

  it("returns a root MIG's own overrides unchanged", () => {
    const root = mig("R", { elementOverrides: { "/Doc/Amt": { minOccurs: 0 } } })
    const { mig: eff, missingParent } = effectiveMig(root, [root])
    expect(missingParent).toBeUndefined()
    expect(eff.elementOverrides).toEqual({ "/Doc/Amt": { minOccurs: 0 } })
  })

  it("reflects the resolvable part when a parent is not loaded", () => {
    const leaf = mig("L", { parentMIG: "EPC:2023", elementOverrides: { "/Doc/Amt": { minOccurs: 0 } } })
    const { mig: eff, missingParent } = effectiveMig(leaf, [leaf])
    expect(missingParent).toBe("EPC:2023")
    expect(eff.elementOverrides).toEqual({ "/Doc/Amt": { minOccurs: 0 } })
  })
})
