import { describe, expect, it } from "vitest"
import { buildCodeListResolver, type RepoCodeSet } from "./codeListResolver"

// Mirrors the real repository: a validation-rule set whose code carries only a
// `name`, traced to a "real" set that carries the wire `codeName`.
const REAL: RepoCodeSet = {
  id: "_real",
  name: "ValidationRuleCode",
  codes: [
    { name: "Received", codeName: "RCVD" },
    { name: "Rejected", codeName: "RJCT" },
    { name: "RequestObjection", codeName: "RQOB" },
  ],
}
const VALIDATION: RepoCodeSet = {
  id: "_val",
  name: "ValidationRuleReceived1Code",
  trace: "_real",
  codes: [{ name: "Received" }], // no codeName — must come via trace
}

describe("buildCodeListResolver", () => {
  it("resolves a validation set's wire codes via its trace (Received -> RCVD)", () => {
    const resolve = buildCodeListResolver([REAL, VALIDATION])
    expect(resolve("ValidationRuleReceived1Code")).toEqual(["RCVD"])
  })

  it("uses a directly-attached codeName when present", () => {
    const resolve = buildCodeListResolver([REAL])
    expect(resolve("ValidationRuleCode")).toEqual(["RCVD", "RJCT", "RQOB"])
  })

  it("returns undefined for an unknown code-set", () => {
    expect(buildCodeListResolver([REAL])("Nope")).toBeUndefined()
  })

  it("fails closed when a member's wire value can't be resolved", () => {
    // trace points nowhere, and the code has no codeName of its own.
    const orphan: RepoCodeSet = {
      id: "_o",
      name: "Orphan",
      trace: "_missing",
      codes: [{ name: "X" }],
    }
    expect(buildCodeListResolver([orphan])("Orphan")).toBeUndefined()
  })

  it("fails closed when only some members resolve", () => {
    const partial: RepoCodeSet = {
      id: "_p",
      name: "Partial",
      trace: "_real",
      codes: [{ name: "Received" }, { name: "Unknown" }], // Unknown not in traced set
    }
    expect(buildCodeListResolver([REAL, partial])("Partial")).toBeUndefined()
  })
})
