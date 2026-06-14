import { describe, expect, it } from "vitest"
import { parse } from "yaml"
import type { MessageDefinition, MessageElement } from "@/core/types/types"
import { serializeMessage } from "./serializeMessage"

function el(over: Partial<MessageElement> = {}): MessageElement {
  return {
    id: "id",
    name: "El",
    xmlTag: "El",
    isAttribute: false,
    definition: "",
    minOccurs: 1,
    maxOccurs: 1,
    typeId: "typeId",
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
    ...over,
  }
}

function message(root: MessageElement): MessageDefinition {
  return {
    name: "FIToFICustomerCreditTransfer",
    identifier: "pacs.008.001.08",
    shortCode: "pacs.008",
    rootElement: root,
  }
}

describe("serializeMessage", () => {
  it("emits formatVersion first, then identity, then the root element, with a trailing newline", () => {
    const yaml = serializeMessage(
      message(el({ name: "Document", xmlTag: "Document" }))
    )
    expect(yaml.split("\n")[0]).toBe("formatVersion: 1")
    expect(Object.keys(parse(yaml))).toEqual([
      "formatVersion",
      "name",
      "identifier",
      "shortCode",
      "rootElement",
    ])
    expect(yaml.endsWith("\n")).toBe(true)
  })

  it("drops internal xmi ids (id, typeId)", () => {
    const parsed = parse(
      serializeMessage(message(el({ id: "_xyz", typeId: "_t" })))
    )
    expect(parsed.rootElement).not.toHaveProperty("id")
    expect(parsed.rootElement).not.toHaveProperty("typeId")
  })

  it("omits null facets and empty collections but keeps name/tag/type/multiplicity", () => {
    const parsed = parse(serializeMessage(message(el({ type: "Text" }))))
    expect(parsed.rootElement).toEqual({
      name: "El",
      xmlTag: "El",
      type: "Text",
      minOccurs: 1,
      maxOccurs: 1,
    })
  })

  it("preserves maxOccurs: null as unbounded", () => {
    const parsed = parse(serializeMessage(message(el({ maxOccurs: null }))))
    expect(parsed.rootElement.maxOccurs).toBeNull()
  })

  it("emits isAttribute / isChoice only when true", () => {
    const root = el({
      xmlTag: "Document",
      elements: [
        el({ name: "Ccy", xmlTag: "Ccy", isAttribute: true }),
        el({ name: "Pick", xmlTag: "Pick", isChoice: true }),
        el({ name: "Plain", xmlTag: "Plain" }),
      ],
    })
    const [attr, choice, plain] = parse(serializeMessage(message(root)))
      .rootElement.elements
    expect(attr.isAttribute).toBe(true)
    expect(choice.isChoice).toBe(true)
    expect(plain).not.toHaveProperty("isAttribute")
    expect(plain).not.toHaveProperty("isChoice")
  })

  it("includes facets, codes, constraints, examples, and nested children", () => {
    const amt = el({
      name: "Amt",
      xmlTag: "Amt",
      type: "ActiveCurrencyAndAmount",
      baseType: "Decimal",
      minOccurs: 0,
      maxOccurs: null,
      definition: "The transferred amount.",
      minInclusive: 0,
      totalDigits: 18,
      fractionDigits: 5,
      examples: ["100.00"],
      constraints: [{ name: "R1", definition: "must be positive" }],
    })
    const ccy = el({
      name: "Ccy",
      xmlTag: "Ccy",
      type: "ActiveCurrencyCode",
      codes: [
        { codeName: "EUR", definition: "Euro" },
        { codeName: "USD", definition: "" },
      ],
    })
    const parsed = parse(
      serializeMessage(
        message(el({ xmlTag: "Document", elements: [amt, ccy] }))
      )
    )
    expect(parsed.rootElement.elements).toHaveLength(2)
    expect(parsed.rootElement.elements[0]).toMatchObject({
      name: "Amt",
      type: "ActiveCurrencyAndAmount",
      baseType: "Decimal",
      minOccurs: 0,
      maxOccurs: null,
      definition: "The transferred amount.",
      minInclusive: 0,
      totalDigits: 18,
      fractionDigits: 5,
      examples: ["100.00"],
      constraints: [{ name: "R1", definition: "must be positive" }],
    })
    // A code with an empty definition is reduced to just its name.
    expect(parsed.rootElement.elements[1].codes).toEqual([
      { codeName: "EUR", definition: "Euro" },
      { codeName: "USD" },
    ])
  })

  it("renders multi-line definitions as block literals without reflowing", () => {
    const text =
      "Line one of the definition.\nLine two continues without wrapping."
    const yaml = serializeMessage(message(el({ definition: text })))
    expect(yaml).toContain("definition: |-")
    expect(parse(yaml).rootElement.definition).toBe(text)
  })
})
