import { describe, expect, it } from "vitest"
import { getMigKey } from "./migKey"

describe("getMigKey", () => {
  it("joins name and version with a colon", () => {
    expect(getMigKey({ name: "EPC-SCTInst", version: "2023" })).toBe(
      "EPC-SCTInst:2023"
    )
  })
})
