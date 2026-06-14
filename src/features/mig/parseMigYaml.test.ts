import { describe, expect, it } from "vitest"
import { parseMigYaml } from "./parseMigYaml"

const yaml = (name: string, version: string) =>
  `name: ${name}\nversion: '${version}'\nmessageIdentifier: pacs.008.001.08\nelementOverrides: {}\n`

/** One MIG as a YAML sequence item (the backup/array form). */
const item = (name: string, version: string, withMessageId = true) =>
  `- name: ${name}\n  version: '${version}'\n` +
  (withMessageId ? "  messageIdentifier: pacs.008.001.08\n" : "") +
  "  elementOverrides: {}\n"

describe("parseMigYaml", () => {
  it("parses and validates a single MIG", () => {
    const { migs, errors } = parseMigYaml(yaml("EPC", "1.0"))
    expect(errors).toEqual([])
    expect(migs).toHaveLength(1)
    expect(migs[0]).toMatchObject({ name: "EPC", version: "1.0" })
  })

  it("parses an array of MIGs", () => {
    const { migs } = parseMigYaml(item("A", "1") + item("B", "1"))
    expect(migs.map((m) => m.name)).toEqual(["A", "B"])
  })

  it("yields nothing (no error) for empty content", () => {
    expect(parseMigYaml("")).toEqual({ migs: [], errors: [] })
  })

  it("reports malformed YAML", () => {
    expect(parseMigYaml("name: [unterminated").errors).toHaveLength(1)
  })

  it("skips and reports an invalid MIG (missing required field)", () => {
    // No messageIdentifier.
    const { migs, errors } = parseMigYaml(
      "name: EPC\nversion: '1.0'\nelementOverrides: {}\n"
    )
    expect(migs).toEqual([])
    expect(errors.join("\n")).toMatch(/messageIdentifier/i)
  })

  it("keeps the valid entries and reports the invalid ones in an array", () => {
    // Second entry has no messageIdentifier.
    const { migs, errors } = parseMigYaml(
      item("Good", "1") + item("Bad", "1", false)
    )
    expect(migs.map((m) => m.name)).toEqual(["Good"])
    expect(errors[0]).toMatch(/Entry 2/)
  })
})
