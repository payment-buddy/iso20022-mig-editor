import { beforeAll, describe, expect, it } from "vitest"
import { parseRepository } from "./eRepository"
import type { ERepository } from "@/core/types/types"

const MINIMAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns:xmi="http://www.omg.org/XMI"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:iso20022="urn:iso:std:iso:20022:2013:ecore">
    <topLevelCatalogueEntry
            xsi:type="iso20022:BusinessArea"
            name="Payments Clearing and Settlement"
            code="pacs"
            definition="Payments area"
            registrationStatus="Registered">
        <messageDefinition
                xmi:id="message-definition-1"
                name="FIToFICustomerCreditTransfer"
                xmlTag="FIToFICstmrCdtTrf"
                definition="FI to FI credit transfer"
                registrationStatus="Registered">
            <messageDefinitionIdentifier
                    businessArea="pacs"
                    messageFunctionality="008"
                    flavour="001"
                    version="13"/>
            <messageBuildingBlock
                    xmi:id="bb1"
                    name="GroupHeader"
                    xmlTag="GrpHdr"
                    definition="Group header"
                    minOccurs="1"
                    maxOccurs="1"
                    complexType="message-component-1"/>
        </messageDefinition>
    </topLevelCatalogueEntry>
    <topLevelDictionaryEntry
            xsi:type="iso20022:MessageComponent"
            xmi:id="message-component-1"
            name="GroupHeader93"
            definition="Group header component">
        <messageElement
                xmi:id="message-element-1"
                name="MessageIdentification"
                xmlTag="MsgId"
                definition="Message ID"
                minOccurs="1"
                maxOccurs="1"
                simpleType="simple-type-1"/>
        <messageElement
                xmi:id="message-element-2"
                name="InstructedAmount"
                xmlTag="InstdAmt"
                definition="Instructed Amount"
                minOccurs="1"
                maxOccurs="5"
                simpleType="simple-type-2"/>
        <constraint
                name="Rule1"
                definition="Some rule"/>
    </topLevelDictionaryEntry>
    <topLevelDictionaryEntry
            xsi:type="iso20022:ChoiceComponent"
            xmi:id="choice-component-1"
            name="SomeChoice"
            definition="A choice type">
        <messageElement
                xmi:id="message-element-3"
                name="OptionA"
                xmlTag="OptA"
                definition="Option A"
                minOccurs="1"
                maxOccurs="1"
                simpleType="simple-type-1"/>
    </topLevelDictionaryEntry>
    <topLevelDictionaryEntry
            xsi:type="iso20022:Text"
            xmi:id="simple-type-1"
            name="Max35Text"
            definition="Max 35 chars"
            maxLength="35"/>
    <topLevelDictionaryEntry
            xsi:type="iso20022:Amount"
            xmi:id="simple-type-2"
            name="ActiveCurrencyAndAmount"
            definition="A number of monetary units specified in an active currency"
            minInclusive="0"
            totalDigits="18"
            fractionDigits="5"
            currencyIdentifierSet="codeset-1">
        <example>6545.56</example>
        <constraint
            xmi:id="_YYB_8dp-Ed-ak6NoX_4Aeg_1337619430"
            name="CurrencyAmount"
            definition="The number of fractional digits"/>
    </topLevelDictionaryEntry>
    <topLevelDictionaryEntry
            xsi:type="iso20022:CodeSet"
            xmi:id="codeset-1"
            name="ActiveCurrencyCode"
            definition="A code allocated to a currency"
            registrationStatus="Registered"
            pattern="[A-Z]{3,3}">
        <example>EUR</example>
        <constraint
            xmi:id="_bqIp59p-Ed-ak6NoX_4Aeg_-767147633"
            name="ActiveCurrency"
            definition="The currency code must be a valid active currency code."
            registrationStatus="Provisionally Registered"/>
    </topLevelDictionaryEntry>
    <topLevelCatalogueEntry
            xsi:type="iso20022:MessageSet"
            name="Credit Transfer Scheme"
            definition="A scheme for credit transfers."
            registrationStatus="Registered"
            messageDefinition="message-definition-1 unknown-id"/>
    <topLevelCatalogueEntry
            xsi:type="iso20022:MessageSet"
            name="Empty Set"
            definition="No resolvable members."
            registrationStatus="Registered"
            messageDefinition="ghost-1 ghost-2"/>
</model>`

function makeFile(content: string, name = "test.iso20022"): File {
  return new File([content], name, { type: "text/xml" })
}

describe("parseRepository", () => {
  let repo: ERepository

  beforeAll(async () => {
    repo = await parseRepository(makeFile(MINIMAL_XML))
  })

  it("parses business areas", async () => {
    expect(repo.businessAreas).toHaveLength(1)
    expect(repo.businessAreas[0].name).toBe("Payments Clearing and Settlement")
    expect(repo.businessAreas[0].code).toBe("pacs")
    expect(repo.businessAreas[0].messages).toHaveLength(1)
  })

  it("parses message sets, resolving members to identifiers", () => {
    // Unknown refs are dropped; a set with no resolvable members is omitted.
    expect(repo.messageSets).toEqual([
      {
        name: "Credit Transfer Scheme",
        definition: "A scheme for credit transfers.",
        messageIdentifiers: ["pacs.008.001.13"],
      },
    ])
  })

  it("parses message definitions", () => {
    expect(repo.businessAreas[0].messages).toEqual([
      {
        name: "FIToFICustomerCreditTransfer",
        identifier: "pacs.008.001.13",
        shortCode: "pacs.008",
        rootElement: {
          id: "message-definition-1",
          name: "FIToFICustomerCreditTransfer",
          xmlTag: "FIToFICstmrCdtTrf",
          isAttribute: false,
          isChoice: false,
          definition: "FI to FI credit transfer",
          minOccurs: 1,
          maxOccurs: 1,
          typeId: "message-definition-1",
          type: "FIToFICustomerCreditTransfer",
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
          elements: [
            {
              id: "bb1",
              name: "GroupHeader",
              xmlTag: "GrpHdr",
              isAttribute: false,
              isChoice: false,
              definition: "Group header",
              minOccurs: 1,
              maxOccurs: 1,
              typeId: "message-component-1",
              type: "GroupHeader93",
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

              constraints: [{ name: "Rule1", definition: "Some rule" }],
              examples: [],
              elements: [
                {
                  id: "message-element-1",
                  name: "MessageIdentification",
                  xmlTag: "MsgId",
                  isAttribute: false,
                  isChoice: false,
                  definition: "Message ID",
                  minOccurs: 1,
                  maxOccurs: 1,
                  typeId: "simple-type-1",
                  type: "Max35Text",
                  baseType: "Text",
                  minInclusive: null,
                  maxInclusive: null,
                  totalDigits: null,
                  fractionDigits: null,
                  length: null,
                  minLength: null,
                  maxLength: 35,
                  pattern: null,
                  baseValue: null,
                  codes: [],

                  constraints: [],
                  examples: [],
                  elements: [],
                },
                {
                  id: "message-element-2",
                  name: "InstructedAmount",
                  xmlTag: "InstdAmt",
                  isAttribute: false,
                  isChoice: false,
                  definition: "Instructed Amount",
                  minOccurs: 1,
                  maxOccurs: 5,
                  typeId: "simple-type-2",
                  type: "ActiveCurrencyAndAmount",
                  baseType: "Amount",
                  minInclusive: 0,
                  maxInclusive: null,
                  totalDigits: 18,
                  fractionDigits: 5,
                  length: null,
                  minLength: null,
                  maxLength: null,
                  pattern: null,
                  baseValue: null,
                  codes: [],
                  constraints: [
                    {
                      name: "CurrencyAmount",
                      definition: "The number of fractional digits",
                    },
                  ],
                  examples: ["6545.56"],
                  elements: [
                    {
                      id: "message-element-2/Ccy",
                      name: "Currency",
                      xmlTag: "Ccy",
                      isAttribute: true,
                      isChoice: false,
                      definition: "",
                      minOccurs: 1,
                      maxOccurs: 1,
                      typeId: "codeset-1",
                      type: "ActiveCurrencyCode",
                      baseType: "CodeSet",
                      minInclusive: null,
                      maxInclusive: null,
                      totalDigits: null,
                      fractionDigits: null,
                      length: null,
                      minLength: null,
                      maxLength: null,
                      pattern: "[A-Z]{3,3}",
                      baseValue: null,
                      codes: [],

                      constraints: [],
                      examples: ["EUR"],
                      elements: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ])
  })

  it("filters out obsolete business areas", async () => {
    const xml = MINIMAL_XML.replace(
      'registrationStatus="Registered">',
      'registrationStatus="Obsolete">'
    )
    const repo = await parseRepository(makeFile(xml))
    expect(repo.businessAreas).toEqual([])
  })

  it("filters out obsolete message definitions", async () => {
    const xml = MINIMAL_XML.replace(
      'definition="FI to FI credit transfer"\n                registrationStatus="Registered"',
      'definition="FI to FI credit transfer"\n                registrationStatus="Obsolete"'
    )
    const repo = await parseRepository(makeFile(xml))
    expect(repo.businessAreas[0].messages).toEqual([])
  })

  it("strips &#xD;&#xA; sequences from attribute values", async () => {
    const xml = MINIMAL_XML.replace(
      'definition="FI to FI credit transfer"',
      'definition="FI to FI&#xD;&#xA;credit transfer"'
    )
    const repo = await parseRepository(makeFile(xml))
    expect(repo.businessAreas[0].messages[0].rootElement.definition).toBe(
      "FI to FI\ncredit transfer"
    )
  })
})

describe("parseRepository — isChoice", () => {
  const xmlWithChoice = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns:xmi="http://www.omg.org/XMI"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:iso20022="urn:iso:std:iso:20022:2013:ecore">
  <topLevelCatalogueEntry xsi:type="iso20022:BusinessArea"
      name="Payments" code="pacs" definition="Payments" registrationStatus="Registered">
    <messageDefinition xmi:id="md1" name="Payment" xmlTag="Pmt" definition="Payment" registrationStatus="Registered">
      <messageDefinitionIdentifier businessArea="pacs" messageFunctionality="001" flavour="001" version="1"/>
      <messageBuildingBlock xmi:id="bb1" name="ChoiceBlock" xmlTag="Chc" definition="A choice" complexType="choice-ct"/>
    </messageDefinition>
  </topLevelCatalogueEntry>
  <topLevelDictionaryEntry xsi:type="iso20022:ChoiceComponent"
      xmi:id="choice-ct" name="SomeChoice" definition="A choice type">
    <messageElement xmi:id="me1" name="OptionA" xmlTag="OptA" definition="Option A" simpleType="st1"/>
  </topLevelDictionaryEntry>
  <topLevelDictionaryEntry xsi:type="iso20022:Text" xmi:id="st1" name="Max35Text" definition="text"/>
</model>`

  it("sets isChoice=true when element references a ChoiceComponent", async () => {
    const repo = await parseRepository(makeFile(xmlWithChoice))
    const bb = repo.businessAreas[0].messages[0].rootElement.elements[0]
    expect(bb.isChoice).toBe(true)
    expect(bb.type).toBe("SomeChoice")
    expect(bb.elements).toHaveLength(1)
    expect(bb.elements[0].isChoice).toBe(false)
    expect(bb.elements[0].baseType).toBe("Text")
  })
})

describe("parseRepository — constraint expressions & code sets", () => {
  // A constraint with a raw ISO RuleDefinition (entity-encoded in the attribute,
  // as it is in the real repository), plus a real and a validation-rule CodeSet.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns:xmi="http://www.omg.org/XMI"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:iso20022="urn:iso:std:iso:20022:2013:ecore">
  <topLevelCatalogueEntry xsi:type="iso20022:BusinessArea"
      name="Payments" code="pacs" definition="Payments" registrationStatus="Registered">
    <messageDefinition xmi:id="md1" name="Payment" xmlTag="Pmt" definition="Payment" registrationStatus="Registered">
      <messageDefinitionIdentifier businessArea="pacs" messageFunctionality="001" flavour="001" version="1"/>
      <messageBuildingBlock xmi:id="bb1" name="Block" xmlTag="Blk" definition="A block" complexType="ct1"/>
    </messageDefinition>
  </topLevelCatalogueEntry>
  <topLevelDictionaryEntry xsi:type="iso20022:MessageComponent" xmi:id="ct1" name="Comp" definition="comp">
    <messageElement xmi:id="me1" name="Field" xmlTag="Fld" definition="f" minOccurs="0" maxOccurs="1" simpleType="st1"/>
    <constraint name="HasExpr" definition="A formal rule"
        expression="&lt;RuleDefinition&gt;&lt;SimpleRule&gt;&lt;mustBe&gt;&lt;BooleanRule xsi:type=&quot;Presence&quot;&gt;&lt;leftOperand&gt;/Field&lt;/leftOperand&gt;&lt;/BooleanRule&gt;&lt;/mustBe&gt;&lt;/SimpleRule&gt;&lt;/RuleDefinition&gt;"/>
    <constraint name="NoExpr" definition="Prose only"/>
  </topLevelDictionaryEntry>
  <topLevelDictionaryEntry xsi:type="iso20022:Text" xmi:id="st1" name="Max35Text" definition="text"/>
  <topLevelDictionaryEntry xsi:type="iso20022:CodeSet" xmi:id="cs-real" name="RealCode" definition="real">
    <code name="Received" codeName="RCVD"/>
  </topLevelDictionaryEntry>
  <topLevelDictionaryEntry xsi:type="iso20022:CodeSet" xmi:id="cs-rule" name="ValidationRule1Code" definition="rule" trace="cs-real">
    <code name="Received"/>
  </topLevelDictionaryEntry>
</model>`

  it("stores the raw ISO expression on the constraint, decoded", async () => {
    const repo = await parseRepository(makeFile(xml))
    const block = repo.businessAreas[0].messages[0].rootElement.elements[0]
    const hasExpr = block.constraints.find((c) => c.name === "HasExpr")!
    expect(hasExpr.isoExpression).toContain("<RuleDefinition>")
    expect(hasExpr.isoExpression).toContain('xsi:type="Presence"')
    // The DSL form is derived later (resolveMessage), not at parse time.
    expect(hasExpr.expression).toBeUndefined()
    const noExpr = block.constraints.find((c) => c.name === "NoExpr")!
    expect(noExpr.isoExpression).toBeUndefined()
  })

  it("captures code sets with name/trace and name-only validation codes", async () => {
    const repo = await parseRepository(makeFile(xml))
    const sets = repo.codeSets ?? []
    const real = sets.find((s) => s.name === "RealCode")!
    expect(real.codes).toEqual([{ name: "Received", codeName: "RCVD" }])
    const rule = sets.find((s) => s.name === "ValidationRule1Code")!
    expect(rule.trace).toBe("cs-real")
    // Validation-rule codes carry only `name`; the wire value is resolved via trace.
    expect(rule.codes).toEqual([{ name: "Received", codeName: undefined }])
  })
})
