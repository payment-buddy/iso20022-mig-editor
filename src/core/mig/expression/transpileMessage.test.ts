import { describe, expect, it } from "vitest"
import type {
  Constraint,
  MessageDefinition,
  MessageElement,
} from "@/core/types/types"
import {
  enrichMessageDsl,
  transpileConstraintExpression,
} from "./transpileMessage"

function el(opts: {
  name?: string
  xmlTag: string
  maxOccurs?: number | null
  isAttribute?: boolean
  elements?: MessageElement[]
  constraints?: Constraint[]
}): MessageElement {
  const { xmlTag } = opts
  return {
    id: xmlTag,
    name: opts.name ?? xmlTag,
    xmlTag,
    isAttribute: opts.isAttribute ?? false,
    definition: "",
    minOccurs: 0,
    maxOccurs: opts.maxOccurs === undefined ? 1 : opts.maxOccurs,
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
    constraints: opts.constraints ?? [],
    examples: [],
    elements: opts.elements ?? [],
  }
}

// ISO element *names* differ from xmlTags; GroupHeader is a singleton, Transaction
// is unbounded (maxOccurs = null).
const owner = el({
  name: "Document",
  xmlTag: "Doc",
  elements: [
    el({
      name: "GroupHeader",
      xmlTag: "GrpHdr",
      maxOccurs: 1,
      elements: [el({ name: "MessageId", xmlTag: "MsgId", maxOccurs: 1 })],
    }),
    el({
      name: "Transaction",
      xmlTag: "Tx",
      maxOccurs: null,
      elements: [el({ name: "Status", xmlTag: "Sts", maxOccurs: 1 })],
    }),
  ],
})

/** Wrap one BooleanRule in a SimpleRule/mustBe RuleDefinition. */
const simpleRule = (booleanRule: string) =>
  `<RuleDefinition><SimpleRule><mustBe>${booleanRule}</mustBe></SimpleRule></RuleDefinition>`

describe("transpileConstraintExpression", () => {
  it("translates ISO names to xmlTags and strips [1] on a singleton", () => {
    const xml = simpleRule(
      '<BooleanRule xsi:type="Presence"><leftOperand>/GroupHeader[1]/MessageId</leftOperand></BooleanRule>'
    )
    expect(transpileConstraintExpression(owner, xml)).toBe("GrpHdr/MsgId")
  })

  it("emits xmlTags in a value comparison", () => {
    const xml = simpleRule(
      '<BooleanRule xsi:type="EqualToValue"><leftOperand>/GroupHeader/MessageId</leftOperand><rightOperand>X</rightOperand></BooleanRule>'
    )
    expect(transpileConstraintExpression(owner, xml)).toBe("GrpHdr/MsgId = 'X'")
  })

  it("expands WithInList via the code-set resolver", () => {
    const xml = simpleRule(
      '<BooleanRule xsi:type="WithInList"><leftOperand>/GroupHeader/MessageId</leftOperand><rightOperand>MyCodeSet</rightOperand></BooleanRule>'
    )
    const resolve = (n: string) => (n === "MyCodeSet" ? ["A", "B"] : undefined)
    expect(transpileConstraintExpression(owner, xml, resolve)).toBe(
      "(GrpHdr/MsgId = 'A' or GrpHdr/MsgId = 'B')"
    )
  })

  it("fails closed when a path doesn't resolve against the owner", () => {
    const xml = simpleRule(
      '<BooleanRule xsi:type="Presence"><leftOperand>/Nonexistent</leftOperand></BooleanRule>'
    )
    expect(transpileConstraintExpression(owner, xml)).toBeNull()
  })

  it("fails closed on a [*] comparison over an unbounded element", () => {
    // Not stripped (Transaction is unbounded), and the DSL has no predicate syntax.
    const xml = simpleRule(
      '<BooleanRule xsi:type="EqualToValue"><leftOperand>/Transaction[*]/Status</leftOperand><rightOperand>OK</rightOperand></BooleanRule>'
    )
    expect(transpileConstraintExpression(owner, xml)).toBeNull()
  })

  it("fails closed on non-XML / free-text rules", () => {
    expect(
      transpileConstraintExpression(owner, "Some free-text rule.")
    ).toBeNull()
  })
})

describe("enrichMessageDsl", () => {
  const presence = simpleRule(
    '<BooleanRule xsi:type="Presence"><leftOperand>/GroupHeader/MessageId</leftOperand></BooleanRule>'
  )

  function message(constraints: Constraint[]): MessageDefinition {
    return {
      name: "Msg",
      identifier: "pacs.001.001.01",
      shortCode: "pacs.001",
      rootElement: el({
        name: "Document",
        xmlTag: "Doc",
        constraints,
        elements: owner.elements,
      }),
    }
  }

  it("derives the DSL expression from a constraint's raw ISO expression", () => {
    const msg = message([
      { name: "R1", definition: "rule", isoExpression: presence },
    ])
    enrichMessageDsl(msg)
    expect(msg.rootElement.constraints[0].expression).toBe("GrpHdr/MsgId")
  })

  it("leaves prose-only constraints and pre-set expressions untouched", () => {
    const msg = message([
      { name: "Prose", definition: "no formal rule" },
      {
        name: "Manual",
        definition: "rule",
        isoExpression: presence,
        expression: "already-set",
      },
    ])
    enrichMessageDsl(msg)
    expect(msg.rootElement.constraints[0].expression).toBeUndefined()
    expect(msg.rootElement.constraints[1].expression).toBe("already-set")
  })
})
