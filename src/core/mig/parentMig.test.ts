import { describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import { getMigKey } from "./migKey"
import { eligibleParents } from "./parentMig"

function mig(
  name: string,
  props: Partial<MessageImplementationGuide> = {},
): MessageImplementationGuide {
  return {
    name,
    version: "1.0",
    messageIdentifier: "pacs.008.001.10",
    elementOverrides: {},
    ...props,
  }
}

const keys = (migs: MessageImplementationGuide[]) => migs.map(getMigKey)

describe("eligibleParents", () => {
  it("offers other MIGs that target the same message", () => {
    const a = mig("A")
    const b = mig("B")
    expect(keys(eligibleParents([a, b], a))).toEqual(["B:1.0"])
  })

  it("excludes the MIG itself", () => {
    const a = mig("A")
    expect(eligibleParents([a], a)).toEqual([])
  })

  it("excludes MIGs targeting a different message", () => {
    const a = mig("A")
    const other = mig("B", { messageIdentifier: "camt.053.001.08" })
    expect(eligibleParents([a, other], a)).toEqual([])
  })

  it("excludes descendants to prevent cycles", () => {
    // B's parent is A → making B the parent of A would form a cycle.
    const a = mig("A")
    const b = mig("B", { parentMIG: "A:1.0" })
    expect(keys(eligibleParents([a, b], a))).toEqual([])
    // A is still a valid parent for B.
    expect(keys(eligibleParents([a, b], b))).toEqual(["A:1.0"])
  })

  it("excludes transitive descendants", () => {
    // A ← B ← C ; none of B, C may parent A.
    const a = mig("A")
    const b = mig("B", { parentMIG: "A:1.0" })
    const c = mig("C", { parentMIG: "B:1.0" })
    expect(keys(eligibleParents([a, b, c], a))).toEqual([])
  })
})
