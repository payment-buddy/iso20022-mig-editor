import { describe, expect, it } from "vitest"
import type {
  Code,
  ElementOverrides,
  MessageDefinition,
  MessageElement,
} from "@/core/types/types"
import { validateMessageInstance, type InstanceNode } from "./validateInstance"

function el(name: string, props: Partial<MessageElement> = {}): MessageElement {
  return {
    id: name,
    name,
    xmlTag: name,
    isAttribute: false,
    definition: "",
    minOccurs: 1,
    maxOccurs: 1,
    typeId: "",
    type: "",
    baseType: null,
    minInclusive: null,
    maxInclusive: null,
    totalDigits: null,
    fractionDigits: null,
    length: null,
    minLength: null,
    maxLength: null,
    pattern: null,
    baseValue: null,
    codes: [],
    constraints: [],
    examples: [],
    elements: [],
    ...props,
  }
}

const codes = (...names: string[]): Code[] =>
  names.map((codeName) => ({ codeName, definition: "" }))

const MESSAGE: MessageDefinition = {
  name: "CreditTransfer",
  identifier: "pacs.008.001.08",
  shortCode: "pacs.008",
  rootElement: el("Doc", {
    // A standard (ISO) constraint with no expression — overlaid in a test below.
    constraints: [{ name: "StdRule", definition: "Std doc rule" }],
    elements: [
      el("GrpHdr", { baseType: "Text", maxLength: 35 }),
      el("Amt", { baseType: "Amount", minInclusive: 0, maxInclusive: 1000 }),
      el("Sts", {
        baseType: "CodeSet",
        minOccurs: 0,
        codes: codes("ACTV", "INAC"),
      }),
      el("Purp", {
        baseType: "CodeSet",
        type: "ExternalPurpose1Code",
        minOccurs: 0,
        codes: codes("CASH", "SALA"),
      }),
      // Optional choice: exactly one of OrgId / PrvtId (each mandatory within the branch).
      el("Pty", {
        isChoice: true,
        minOccurs: 0,
        elements: [
          el("OrgId", { baseType: "Text" }),
          el("PrvtId", { baseType: "Text" }),
        ],
      }),
    ],
  }),
}

function node(
  localName: string,
  props: Partial<InstanceNode> = {}
): InstanceNode {
  return { localName, attributes: {}, text: "", children: [], ...props }
}

const leaf = (localName: string, text: string) => node(localName, { text })

function run(root: InstanceNode, overrides: ElementOverrides = {}) {
  return validateMessageInstance(root, MESSAGE, overrides)
}

const valid = () =>
  node("Doc", {
    children: [leaf("GrpHdr", "ABC"), leaf("Amt", "500"), leaf("Sts", "ACTV")],
  })

describe("validateMessageInstance", () => {
  it("accepts a conforming instance", () => {
    expect(run(valid())).toEqual([])
  })

  it("flags a root that doesn't match the message", () => {
    expect(run(node("Other"))[0]).toMatchObject({
      message: expect.stringMatching(/does not match/i),
    })
  })

  it("flags missing required and over-max cardinality", () => {
    // No GrpHdr/Amt (both required), two Sts (max 1).
    const d = run(
      node("Doc", { children: [leaf("Sts", "ACTV"), leaf("Sts", "INAC")] })
    )
    expect(d).toContainEqual(
      expect.objectContaining({
        path: "/Doc/GrpHdr",
        message: expect.stringMatching(/minimum is 1/i),
      })
    )
    expect(d).toContainEqual(
      expect.objectContaining({
        path: "/Doc/Amt",
        message: expect.stringMatching(/minimum is 1/i),
      })
    )
    expect(d).toContainEqual(
      expect.objectContaining({
        path: "/Doc/Sts",
        message: expect.stringMatching(/maximum is 1/i),
      })
    )
  })

  it("flags an element the MIG excludes but the instance still contains", () => {
    const d = run(valid(), { "/Doc/Sts": { maxOccurs: 0 } })
    expect(d[0]).toMatchObject({
      path: "/Doc/Sts",
      message: expect.stringMatching(/excluded.*appears 1/i),
    })
  })

  it("flags a value outside the code set, length, and inclusive range", () => {
    expect(
      run(
        node("Doc", {
          children: [
            leaf("GrpHdr", "x"),
            leaf("Amt", "500"),
            leaf("Sts", "ZZZ"),
          ],
        })
      )
    ).toContainEqual(
      expect.objectContaining({
        path: "/Doc/Sts",
        message: expect.stringMatching(/not an allowed value/i),
      })
    )
    expect(
      run(
        node("Doc", {
          children: [leaf("GrpHdr", "x".repeat(40)), leaf("Amt", "500")],
        })
      )
    ).toContainEqual(
      expect.objectContaining({
        path: "/Doc/GrpHdr",
        message: expect.stringMatching(/max length 35/i),
      })
    )
    expect(
      run(node("Doc", { children: [leaf("GrpHdr", "x"), leaf("Amt", "2000")] }))
    ).toContainEqual(
      expect.objectContaining({
        path: "/Doc/Amt",
        message: expect.stringMatching(/above the maximum 1000/i),
      })
    )
  })

  it("accepts a value beyond the snapshot for an external code set", () => {
    // ExternalPurpose1Code is open-ended — SUPP isn't in the snapshot but is valid.
    expect(
      run(
        node("Doc", {
          children: [
            leaf("GrpHdr", "x"),
            leaf("Amt", "500"),
            leaf("Purp", "SUPP"),
          ],
        })
      )
    ).toEqual([])
  })

  it("still enforces a MIG restriction on an external code set", () => {
    // The MIG narrows Purp to {CASH}; SUPP now violates that explicit list.
    expect(
      run(
        node("Doc", {
          children: [
            leaf("GrpHdr", "x"),
            leaf("Amt", "500"),
            leaf("Purp", "SUPP"),
          ],
        }),
        { "/Doc/Purp": { allowedValues: ["CASH"] } }
      )
    ).toContainEqual(
      expect.objectContaining({
        path: "/Doc/Purp",
        message: expect.stringMatching(/not an allowed value/i),
      })
    )
  })

  it("validates against the effective (tightened) MIG facets", () => {
    // MIG tightens GrpHdr maxLength to 5; a length-8 value violates it.
    const d = run(
      node("Doc", {
        children: [leaf("GrpHdr", "12345678"), leaf("Amt", "500")],
      }),
      {
        "/Doc/GrpHdr": { maxLength: 5 },
      }
    )
    expect(d).toContainEqual(
      expect.objectContaining({
        path: "/Doc/GrpHdr",
        message: expect.stringMatching(/max length 5/i),
      })
    )
  })

  it("accepts a choice with exactly one branch, without flagging the other as missing", () => {
    const doc = node("Doc", {
      children: [
        leaf("GrpHdr", "x"),
        leaf("Amt", "500"),
        node("Pty", { children: [leaf("OrgId", "ID")] }),
      ],
    })
    // OrgId chosen; PrvtId absent is fine (not "minimum is 1").
    expect(run(doc)).toEqual([])
  })

  it("flags a choice with more than one branch", () => {
    const doc = node("Doc", {
      children: [
        leaf("GrpHdr", "x"),
        leaf("Amt", "500"),
        node("Pty", { children: [leaf("OrgId", "ID"), leaf("PrvtId", "ID")] }),
      ],
    })
    expect(run(doc)).toContainEqual(
      expect.objectContaining({
        path: "/Doc/Pty",
        message: expect.stringMatching(/only one branch.*OrgId, PrvtId/i),
      })
    )
  })

  it("flags a choice with no branch present", () => {
    const doc = node("Doc", {
      children: [leaf("GrpHdr", "x"), leaf("Amt", "500"), node("Pty")],
    })
    expect(run(doc)).toContainEqual(
      expect.objectContaining({
        path: "/Doc/Pty",
        message: expect.stringMatching(/requires one of: OrgId, PrvtId/i),
      })
    )
  })

  it("flags an element not declared in the message", () => {
    const d = run(
      node("Doc", {
        children: [leaf("GrpHdr", "x"), leaf("Amt", "500"), leaf("Bogus", "y")],
      })
    )
    expect(d).toContainEqual(
      expect.objectContaining({
        path: "/Doc",
        message: expect.stringMatching(/unexpected element <Bogus>/i),
      })
    )
  })

  describe("MIG-added constraint expressions", () => {
    const constraint = (
      expression: string,
      definition = "Amount must exceed 600"
    ): ElementOverrides => ({
      "/Doc": {
        additionalConstraints: { AmtRule: { definition, expression } },
      },
    })

    it("flags a constraint whose expression is false, pointing at the constraint node", () => {
      // Amt is 500, so "Amt > 600" fails on the Doc context node.
      const d = run(valid(), constraint("Amt > 600"))
      expect(d).toContainEqual({
        kind: "constraint",
        path: "/Doc/AmtRule",
        elementName: "AmtRule",
        message: "Amount must exceed 600",
      })
    })

    it("falls back to a generic message when the constraint has no definition", () => {
      const d = run(valid(), constraint("Amt > 600", ""))
      expect(d[0]).toMatchObject({
        message: "This constraint is not satisfied.",
      })
    })

    it("passes a satisfied expression", () => {
      expect(run(valid(), constraint("Amt > 100 and Sts = 'ACTV'"))).toEqual([])
    })

    it("skips a constraint with no expression, a syntax error, or an unsupported function", () => {
      expect(
        run(valid(), {
          "/Doc": { additionalConstraints: { X: { definition: "" } } },
        })
      ).toEqual([])
      expect(run(valid(), constraint("Amt >"))).toEqual([]) // syntax error → skipped
      expect(run(valid(), constraint("contains(Sts, 'A')"))).toEqual([]) // indeterminate → skipped
    })

    it("evaluates an expression overlaid on a standard (ISO) constraint", () => {
      // StdRule has no expression by default; the overlay adds one that fails.
      const d = run(valid(), {
        "/Doc": {
          constraintOverrides: { StdRule: { expression: "Amt > 600" } },
        },
      })
      expect(d).toContainEqual({
        kind: "constraint",
        path: "/Doc/StdRule",
        elementName: "StdRule",
        message: "Std doc rule",
      })
      // A passing overlay produces no diagnostic.
      expect(
        run(valid(), {
          "/Doc": {
            constraintOverrides: { StdRule: { expression: "Amt > 100" } },
          },
        })
      ).toEqual([])
    })

    it("skips a disabled added rule even when its expression would fail", () => {
      const overrides = {
        "/Doc": {
          additionalConstraints: {
            R: { definition: "", expression: "Amt > 600", enabled: false },
          },
        },
      }
      expect(run(valid(), overrides)).toEqual([])
    })

    it("still honours a legacy constraintOverrides disable on an added rule", () => {
      const overrides = {
        "/Doc": {
          additionalConstraints: {
            R: { definition: "", expression: "Amt > 600" },
          },
          constraintOverrides: { R: { disabled: true } },
        },
      }
      expect(run(valid(), overrides)).toEqual([])
    })
  })
})
