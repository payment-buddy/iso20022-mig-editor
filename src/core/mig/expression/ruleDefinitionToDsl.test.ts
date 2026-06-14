import { describe, it, expect } from "vitest"
import { ruleDefinitionToDsl } from "./ruleDefinitionToDsl"
import { parseExpression } from "./parser"

/** Convenience: assert a successful transpile and return the DSL. */
function dsl(xml: string): string {
  const r = ruleDefinitionToDsl(xml)
  if (!r.ok) throw new Error(`expected ok, got skip: ${r.reason}`)
  return r.dsl
}

/** Assert the transpile was skipped and return the reason. */
function skip(xml: string): string {
  const r = ruleDefinitionToDsl(xml)
  if (r.ok) throw new Error(`expected skip, got dsl: ${r.dsl}`)
  return r.reason
}

const rd = (inner: string) => `<RuleDefinition>${inner}</RuleDefinition>`
const simple = (inner: string) =>
  rd(`<SimpleRule xsi:type="SimpleRule">${inner}</SimpleRule>`)
const complex = (mustBe: string, onCondition: string) =>
  rd(`<ComplexRule xsi:type="ComplexRule">${mustBe}${onCondition}</ComplexRule>`)
const presence = (p: string) =>
  `<BooleanRule xsi:type="Presence"><leftOperand>${p}</leftOperand></BooleanRule>`

describe("ruleDefinitionToDsl — supported shapes", () => {
  it("SimpleRule: OR of two presences (real SafekeepingAccount rule)", () => {
    const xml = simple(
      `<mustBe><connector>OR</connector>` +
        presence("/SafekeepingAccount") +
        presence("/BlockChainAddressOrWallet") +
        `</mustBe>`,
    )
    expect(dsl(xml)).toBe("SafekeepingAccount or BlockChainAddressOrWallet")
  })

  it("ComplexRule: presence required when a value matches (real OriginalActivation rule)", () => {
    const xml = complex(
      `<mustBe><connector>OR</connector>${presence("/OriginalActivationReference")}</mustBe>`,
      `<onCondition><connector>AND</connector>` +
        `<BooleanRule xsi:type="EqualToValue"><leftOperand>/Status/Code</leftOperand>` +
        `<rightOperand>Accepted</rightOperand></BooleanRule></onCondition>`,
    )
    expect(dsl(xml)).toBe("not(Status/Code = 'Accepted') or OriginalActivationReference")
  })

  it("drops the [*] any-occurrence marker in a presence/absence path", () => {
    const xml = simple(
      `<mustBe><connector>AND</connector>` +
        presence("/Availability[*]/Type") +
        `<BooleanRule xsi:type="Absence"><leftOperand>/Removal[*]</leftOperand></BooleanRule>` +
        `</mustBe>`,
    )
    expect(dsl(xml)).toBe("Availability/Type and not(Removal)")
  })

  it("Absence becomes not(path)", () => {
    const xml = simple(
      `<mustBe><connector>AND</connector>` +
        `<BooleanRule xsi:type="Absence"><leftOperand>/ChequeMaturityDate</leftOperand></BooleanRule>` +
        `</mustBe>`,
    )
    expect(dsl(xml)).toBe("not(ChequeMaturityDate)")
  })

  it("DifferentFromValue becomes !=", () => {
    const xml = simple(
      `<mustBe><connector>AND</connector>` +
        `<BooleanRule xsi:type="DifferentFromValue"><leftOperand>/Tp</leftOperand>` +
        `<rightOperand>OPEN</rightOperand></BooleanRule></mustBe>`,
    )
    expect(dsl(xml)).toBe("Tp != 'OPEN'")
  })

  it("EqualToNode compares two paths, attributes via @", () => {
    const xml = simple(
      `<mustBe><connector>AND</connector>` +
        `<BooleanRule xsi:type="EqualToNode"><leftOperand>/Amt/@Ccy</leftOperand>` +
        `<rightOperand>/TtlAmt/@Ccy</rightOperand></BooleanRule></mustBe>`,
    )
    expect(dsl(xml)).toBe("Amt/@Ccy = TtlAmt/@Ccy")
  })

  it("AND-joins multiple rules in a block", () => {
    const xml = simple(
      `<mustBe><connector>AND</connector>` +
        presence("/A") +
        presence("/B") +
        presence("/C") +
        `</mustBe>`,
    )
    expect(dsl(xml)).toBe("A and B and C")
  })

  it("ComplexRule with multi-term mustBe parenthesises the consequent", () => {
    const xml = complex(
      `<mustBe><connector>AND</connector>${presence("/A")}${presence("/B")}</mustBe>`,
      `<onCondition><connector>AND</connector>${presence("/C")}</onCondition>`,
    )
    expect(dsl(xml)).toBe("not(C) or (A and B)")
  })

  it("escapes single quotes in a value literal", () => {
    const xml = simple(
      `<mustBe><connector>AND</connector>` +
        `<BooleanRule xsi:type="EqualToValue"><leftOperand>/Nm</leftOperand>` +
        `<rightOperand>O'Brien</rightOperand></BooleanRule></mustBe>`,
    )
    expect(dsl(xml)).toBe("Nm = 'O''Brien'")
  })

  it("every supported output re-parses cleanly in the DSL", () => {
    const samples = [
      simple(`<mustBe><connector>OR</connector>${presence("/A")}${presence("/B")}</mustBe>`),
      complex(
        `<mustBe><connector>AND</connector>${presence("/X")}</mustBe>`,
        `<onCondition><connector>OR</connector>${presence("/Y")}${presence("/Z")}</onCondition>`,
      ),
    ]
    for (const xml of samples) {
      expect(parseExpression(dsl(xml)).ok).toBe(true)
    }
  })
})

describe("ruleDefinitionToDsl — fail closed", () => {
  it("skips WithInList (code-set membership)", () => {
    const xml = complex(
      `<mustBe><connector>AND</connector>${presence("/ChequeMaturityDate")}</mustBe>`,
      `<onCondition><connector>AND</connector>` +
        `<BooleanRule xsi:type="WithInList"><leftOperand>/ChequeType</leftOperand>` +
        `<rightOperand>ChequeType3Code</rightOperand></BooleanRule></onCondition>`,
    )
    expect(skip(xml)).toMatch(/unsupported/)
  })

  it("skips [*] in a comparison (universal intent ≠ existential semantics)", () => {
    const xml = simple(
      `<mustBe><connector>AND</connector>` +
        `<BooleanRule xsi:type="EqualToNode"><leftOperand>/Item[*]/Amount/@Currency</leftOperand>` +
        `<rightOperand>/TotalAmount/@Currency</rightOperand></BooleanRule></mustBe>`,
    )
    expect(skip(xml)).toMatch(/unsupported/)
  })

  it("skips a specific occurrence index [1] everywhere", () => {
    const xml = simple(
      `<mustBe><connector>AND</connector>${presence("/Item[1]/Amount")}</mustBe>`,
    )
    expect(skip(xml)).toMatch(/unsupported/)
  })

  it("skips free-text (non-XML) expressions", () => {
    expect(skip("Following Must be True\r\n\t/A Must be present")).toMatch(/not valid XML/)
  })

  it("skips an empty / whitespace expression", () => {
    expect(skip(" ")).toMatch(/not valid XML/)
  })

  it("skips a ComplexRule missing its onCondition", () => {
    const xml = rd(
      `<ComplexRule xsi:type="ComplexRule"><mustBe><connector>AND</connector>` +
        presence("/A") +
        `</mustBe></ComplexRule>`,
    )
    expect(skip(xml)).toMatch(/onCondition/)
  })

  it("skips an unknown root element", () => {
    expect(skip("<Foo/>")).toMatch(/RuleDefinition/)
  })
})

describe("ruleDefinitionToDsl — code-set membership with a resolver", () => {
  const withInList = (left: string, set: string, type = "WithInList") =>
    `<BooleanRule xsi:type="${type}"><leftOperand>${left}</leftOperand>` +
    `<rightOperand>${set}</rightOperand></BooleanRule>`

  // Stub resolver standing in for buildCodeListResolver (Received -> RCVD).
  const opts = {
    resolveCodeList: (name: string) =>
      name === "ValidationRuleReceived1Code" ? ["RCVD"] : name === "Cheque3Code" ? ["CHQ", "BCHQ"] : undefined,
  }

  it("expands WithInList to an OR-chain over wire codes", () => {
    const xml = simple(`<mustBe><connector>AND</connector>${withInList("/Tp", "Cheque3Code")}</mustBe>`)
    const r = ruleDefinitionToDsl(xml, opts)
    expect(r.ok && r.dsl).toBe("(Tp = 'CHQ' or Tp = 'BCHQ')")
  })

  it("drops the parentheses for a single-code set", () => {
    const xml = simple(
      `<mustBe><connector>AND</connector>${withInList("/GroupStatus", "ValidationRuleReceived1Code")}</mustBe>`,
    )
    const r = ruleDefinitionToDsl(xml, opts)
    expect(r.ok && r.dsl).toBe("GroupStatus = 'RCVD'")
  })

  it("negates NotWithInList", () => {
    const xml = simple(
      `<mustBe><connector>AND</connector>${withInList("/Tp", "Cheque3Code", "NotWithInList")}</mustBe>`,
    )
    const r = ruleDefinitionToDsl(xml, opts)
    expect(r.ok && r.dsl).toBe("not(Tp = 'CHQ' or Tp = 'BCHQ')")
  })

  it("real shape: ComplexRule condition using WithInList (Received -> RCVD)", () => {
    const xml = complex(
      `<mustBe><connector>AND</connector>${presence("/PaymentInformationStatus")}</mustBe>`,
      `<onCondition><connector>AND</connector>` +
        presence("/GroupStatus") +
        withInList("/GroupStatus", "ValidationRuleReceived1Code") +
        `</onCondition>`,
    )
    const r = ruleDefinitionToDsl(xml, opts)
    expect(r.ok && r.dsl).toBe(
      "not(GroupStatus and GroupStatus = 'RCVD') or PaymentInformationStatus",
    )
  })

  it("still fails closed without a resolver, or when the set is unresolved", () => {
    const xml = simple(`<mustBe><connector>AND</connector>${withInList("/Tp", "Cheque3Code")}</mustBe>`)
    expect(skip(xml)).toMatch(/unsupported/) // no opts
    const unknown = simple(`<mustBe><connector>AND</connector>${withInList("/Tp", "MysterySet")}</mustBe>`)
    const r = ruleDefinitionToDsl(unknown, opts)
    expect(r.ok).toBe(false)
  })
})
