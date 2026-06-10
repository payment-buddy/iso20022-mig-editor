import { describe, expect, it } from "vitest"
import { treeFilterMatch } from "./treeFilterMatch"

describe("treeFilterMatch", () => {
  describe("lowercase queries (substring, unchanged behavior)", () => {
    it("matches a case-insensitive substring anywhere", () => {
      expect(treeFilterMatch("InstructingAgent", "agent")).toBe(true)
      expect(treeFilterMatch("InstructingAgent", "struct")).toBe(true)
      expect(treeFilterMatch("InstructingAgent", "instructingagent")).toBe(true)
    })

    it("does not treat a lowercase query as a subsequence", () => {
      // "ina" is not a substring of "InstructingAgent" (the hump is "In…Agent").
      expect(treeFilterMatch("InstructingAgent", "ina")).toBe(false)
    })
  })

  describe("CamelHumps queries (an uppercase letter opts in)", () => {
    it("matches initials across humps", () => {
      expect(treeFilterMatch("InstructingAgent", "InA")).toBe(true)
      expect(
        treeFilterMatch("InstructedReimbursementAgentAccount", "InA")
      ).toBe(true)
    })

    it("treats lowercase after a capital as a hump prefix", () => {
      expect(treeFilterMatch("InstructingAgent", "InstAg")).toBe(true)
      expect(treeFilterMatch("InstructingAgent", "InsAgent")).toBe(true)
    })

    it("skips non-matching humps, including leading ones", () => {
      expect(treeFilterMatch("ReInstructedAgent", "InA")).toBe(true)
      expect(
        treeFilterMatch("InstructedReimbursementAgentAccount", "AgAc")
      ).toBe(true)
    })

    it("works on abbreviated xmlTags", () => {
      expect(treeFilterMatch("InstgAgt", "InA")).toBe(true)
      expect(treeFilterMatch("InstgAgt", "InstgAgt")).toBe(true)
    })

    it("requires the humps in order", () => {
      // "AgIn" can't match: no "In…" hump follows the "Ag…" hump.
      expect(treeFilterMatch("InstructingAgent", "AgIn")).toBe(false)
    })

    it("fails when a segment matches no remaining hump", () => {
      expect(treeFilterMatch("InstructingAgent", "InX")).toBe(false)
      expect(treeFilterMatch("InstructingAgent", "InAgentX")).toBe(false)
    })

    it("matches a single capitalized word against any hump", () => {
      expect(treeFilterMatch("InstructingAgent", "Agent")).toBe(true)
      expect(treeFilterMatch("InstructingAgent", "Agt")).toBe(false)
    })
  })
})
