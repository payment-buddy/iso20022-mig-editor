import { describe, expect, it } from "vitest"
import { parseMigYaml } from "./parseMigYaml"

describe("parseMigYaml", () => {
  it("parses a single MIG into a one-element array", () => {
    const migs = parseMigYaml("name: EPC\nversion: '1.0'\nelementOverrides: {}\n")
    expect(migs).toHaveLength(1)
    expect(migs[0]).toMatchObject({ name: "EPC", version: "1.0" })
  })

  it("parses an array of MIGs", () => {
    const migs = parseMigYaml(
      "- name: A\n  version: '1'\n  elementOverrides: {}\n- name: B\n  version: '1'\n  elementOverrides: {}\n",
    )
    expect(migs.map((m) => m.name)).toEqual(["A", "B"])
  })

  it("returns an empty array for empty or scalar content", () => {
    expect(parseMigYaml("")).toEqual([])
    expect(parseMigYaml("just a string")).toEqual([])
    expect(parseMigYaml("- 1\n- 2\n")).toEqual([])
  })
})
