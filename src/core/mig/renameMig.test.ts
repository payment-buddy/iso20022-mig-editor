import { describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import { renameMig } from "./renameMig"

function mig(
  name: string,
  version: string,
  over: Partial<MessageImplementationGuide> = {},
): MessageImplementationGuide {
  return { name, version, messageIdentifier: "pacs.008.001.08", elementOverrides: {}, ...over }
}

describe("renameMig", () => {
  it("re-keys the MIG and repoints child parentMIG references", () => {
    const parent = mig("EPC", "1.0")
    const child = mig("Bank", "1", { parentMIG: "EPC:1.0" })
    const other = mig("Other", "1", { parentMIG: "Else:1" })

    const r = renameMig([parent, child, other], "EPC:1.0", "EPC", "2.0")
    expect(r).toMatchObject({ ok: true, changed: true, oldKey: "EPC:1.0", newKey: "EPC:2.0" })
    if (!r.ok) return
    expect(r.renamed).toMatchObject({ name: "EPC", version: "2.0" })
    // Only the child pointing at the old key is repointed.
    expect(r.reparented).toEqual([{ ...child, parentMIG: "EPC:2.0" }])
  })

  it("trims, and reports no change when name+version are unchanged", () => {
    const r = renameMig([mig("EPC", "1.0")], "EPC:1.0", "  EPC  ", " 1.0 ")
    expect(r).toMatchObject({ ok: true, changed: false, newKey: "EPC:1.0", reparented: [] })
  })

  it("rejects a blank name or version", () => {
    const m = mig("EPC", "1.0")
    expect(renameMig([m], "EPC:1.0", "", "1.0")).toMatchObject({ ok: false })
    expect(renameMig([m], "EPC:1.0", "EPC", "   ")).toMatchObject({ ok: false })
  })

  it("rejects a collision with a different MIG", () => {
    const r = renameMig([mig("EPC", "1.0"), mig("Taken", "1.0")], "EPC:1.0", "Taken", "1.0")
    expect(r).toEqual({ ok: false, error: expect.stringContaining("already exists") })
  })
})
