import { describe, expect, it } from "vitest"
import type {
  ERepository,
  MessageDefinition,
  MessageElement,
} from "@/core/types/types"
import { resolveMessage } from "./resolveMessage"

function msg(
  name: string,
  shortCode: string,
  identifier: string
): MessageDefinition {
  return {
    name,
    shortCode,
    identifier,
    rootElement: {} as MessageDefinition["rootElement"],
  }
}

const REPO: ERepository = {
  businessAreas: [
    {
      name: "Payments Clearing",
      code: "pacs",
      definition: "",
      messages: [
        msg("CreditTransferV08", "pacs.008", "pacs.008.001.08"),
        msg("CreditTransferV10", "pacs.008", "pacs.008.001.10"),
        msg("PaymentStatusV12", "pacs.002", "pacs.002.001.12"),
      ],
    },
  ],
}

describe("resolveMessage", () => {
  it("resolves an exact identifier to that version", () => {
    const r = resolveMessage(REPO, "pacs.008.001.08")!
    expect(r.current.identifier).toBe("pacs.008.001.08")
    expect(r.versions.map((v) => v.identifier)).toEqual([
      "pacs.008.001.08",
      "pacs.008.001.10",
    ])
  })

  it("resolves a shortCode to the latest version", () => {
    const r = resolveMessage(REPO, "pacs.008")!
    expect(r.current.identifier).toBe("pacs.008.001.10")
  })

  it("returns null for an unknown code", () => {
    expect(resolveMessage(REPO, "nope.999")).toBeNull()
  })
})

describe("resolveMessage — DSL enrichment", () => {
  function leaf(name: string, xmlTag: string): MessageElement {
    return {
      id: xmlTag,
      name,
      xmlTag,
      isAttribute: false,
      definition: "",
      minOccurs: 0,
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
    }
  }

  function repoWithRule(): ERepository {
    const root = leaf("Document", "Doc")
    root.elements = [leaf("MessageId", "MsgId")]
    root.constraints = [
      {
        name: "R1",
        definition: "rule",
        isoExpression:
          '<RuleDefinition><SimpleRule><mustBe><BooleanRule xsi:type="Presence"><leftOperand>/MessageId</leftOperand></BooleanRule></mustBe></SimpleRule></RuleDefinition>',
      },
    ]
    return {
      businessAreas: [
        {
          name: "Payments",
          code: "pacs",
          definition: "",
          messages: [
            {
              name: "Msg",
              shortCode: "pacs.001",
              identifier: "pacs.001.001.01",
              rootElement: root,
            },
          ],
        },
      ],
    }
  }

  it("fills the constraint's DSL expression from its raw ISO expression", () => {
    const repo = repoWithRule()
    const r = resolveMessage(repo, "pacs.001.001.01")!
    expect(r.current.rootElement.constraints[0].expression).toBe("MsgId")
    // Raw form is preserved alongside the derived DSL.
    expect(r.current.rootElement.constraints[0].isoExpression).toContain(
      "RuleDefinition"
    )
  })

  it("is idempotent across repeated resolves (memoized)", () => {
    const repo = repoWithRule()
    resolveMessage(repo, "pacs.001.001.01")
    const again = resolveMessage(repo, "pacs.001.001.01")!
    expect(again.current.rootElement.constraints[0].expression).toBe("MsgId")
  })
})
