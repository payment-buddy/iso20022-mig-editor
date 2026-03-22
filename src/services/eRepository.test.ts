import {beforeAll, describe, expect, it} from 'vitest'
import {parseRepository} from './eRepository.ts'
import type {ComplexType, ERepository} from '../types/types.ts'

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
                definition="Some rule"
                expression="some expression"/>
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
</model>`

function makeFile(content: string, name = 'test.iso20022'): File {
    return new File([content], name, {type: 'text/xml'})
}

describe('parseRepository', () => {
    let repo: ERepository

    beforeAll(async () => {
        repo = await parseRepository(makeFile(MINIMAL_XML))
    })

    it('parses business areas', async () => {
        expect(repo.businessAreas).toHaveLength(1)
        expect(repo.businessAreas[0].name).toBe('Payments Clearing and Settlement')
        expect(repo.businessAreas[0].code).toBe('pacs')
        expect(repo.businessAreas[0].messages).toHaveLength(1)
    })

    it('parses message definitions', () => {
        expect(repo.businessAreas[0].messages).toEqual([{
            name: 'FIToFICustomerCreditTransfer',
            identifier: 'pacs.008.001.13',
            shortCode: 'pacs.008',
            definition: 'FI to FI credit transfer',
            xmlTag: 'FIToFICstmrCdtTrf',
            constraints: [],
            elements: [{
                id: 'bb1',
                name: 'GroupHeader',
                xmlTag: 'GrpHdr',
                isAttribute: false,
                definition: 'Group header',
                minOccurs: 1,
                maxOccurs: 1,
                typeId: 'message-component-1',
                examples: [],
                constraints: [],
            }],
        }])
    })

    it('parses MessageComponent complex type', () => {
        expect(repo.dataTypes.get('message-component-1')).toEqual({
            name: 'GroupHeader93',
            definition: 'Group header component',
            isChoice: false,
            constraints: [{name: 'Rule1', definition: 'Some rule', expression: 'some expression'}],
            elements: [
                {
                    id: 'message-element-1',
                    name: 'MessageIdentification',
                    xmlTag: 'MsgId',
                    isAttribute: false,
                    definition: 'Message ID',
                    minOccurs: 1,
                    maxOccurs: 1,
                    typeId: 'simple-type-1',
                    examples: [],
                    constraints: []
                },
                {
                    id: 'message-element-2',
                    name: 'InstructedAmount',
                    xmlTag: 'InstdAmt',
                    isAttribute: false,
                    definition: 'Instructed Amount',
                    minOccurs: 1,
                    maxOccurs: 5,
                    typeId: 'simple-type-2',
                    examples: [],
                    constraints: []
                },
            ],
        })
    })

    it('parses ChoiceComponent complex type', () => {
        expect(repo.dataTypes.get('choice-component-1')).toEqual({
            name: 'SomeChoice',
            definition: 'A choice type',
            isChoice: true,
            constraints: [],
            elements: [
                {
                    id: 'message-element-3',
                    name: 'OptionA',
                    xmlTag: 'OptA',
                    isAttribute: false,
                    definition: 'Option A',
                    minOccurs: 1,
                    maxOccurs: 1,
                    typeId: 'simple-type-1',
                    examples: [],
                    constraints: []
                },
            ],
        })
    })

    it('parses Text simple type', () => {
        expect(repo.dataTypes.get('simple-type-1')).toEqual({
            name: 'Max35Text',
            definition: 'Max 35 chars',
            baseType: 'Text',
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
            examples: [],
            constraints: [],
            currencyIdentifierSet: null,
        })
    })

    it('parses Amount simple type', () => {
        expect(repo.dataTypes.get('simple-type-2')).toEqual({
            name: 'ActiveCurrencyAndAmount',
            definition: 'A number of monetary units specified in an active currency',
            baseType: 'Amount',
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
            constraints: [{
                name: "CurrencyAmount",
                definition: "The number of fractional digits",
                expression: null,
            }],
            currencyIdentifierSet: 'codeset-1',
            examples: ['6545.56'],
        })
    })

    it('filters out obsolete business areas', async () => {
        const xml = MINIMAL_XML.replace(
            'registrationStatus="Registered">',
            'registrationStatus="Obsolete">'
        )
        const repo = await parseRepository(makeFile(xml))
        expect(repo.businessAreas).toEqual([])
    })

    it('filters out obsolete message definitions', async () => {
        const xml = MINIMAL_XML.replace(
            'definition="FI to FI credit transfer"\n                registrationStatus="Registered"',
            'definition="FI to FI credit transfer"\n                registrationStatus="Obsolete"'
        )
        const repo = await parseRepository(makeFile(xml))
        expect(repo.businessAreas[0].messages).toEqual([])
    })

    it('strips &#xD;&#xA; sequences from attribute values', async () => {
        const xml = MINIMAL_XML.replace(
            'definition="FI to FI credit transfer"',
            'definition="FI to FI&#xD;&#xA;credit transfer"'
        )
        const repo = await parseRepository(makeFile(xml))
        expect(repo.businessAreas[0].messages[0].definition).toBe('FI to FI\ncredit transfer')
    })
})

describe('parseRepository — codes', () => {
    const xmlWithCodes = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns:xmi="http://www.omg.org/XMI"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:iso20022="urn:iso:std:iso:20022:2013:ecore">
  <topLevelCatalogueEntry xsi:type="iso20022:BusinessArea"
      name="Payments" code="pacs" definition="Payments" registrationStatus="Registered">
  </topLevelCatalogueEntry>
  <topLevelDictionaryEntry xsi:type="iso20022:CodeSet"
      xmi:id="cs1"
      name="Priority2Code"
      definition="Priority code">
    <code codeName="HIGH" definition="High priority"/>
    <code codeName="NORM" definition="Normal priority"/>
  </topLevelDictionaryEntry>
</model>`

    it('parses CodeSet simple type', async () => {
        const repo = await parseRepository(makeFile(xmlWithCodes))
        expect(repo.dataTypes.get('cs1')).toEqual({
            name: 'Priority2Code',
            definition: 'Priority code',
            baseType: 'CodeSet',
            minInclusive: null,
            maxInclusive: null,
            totalDigits: null,
            fractionDigits: null,
            length: null,
            minLength: null,
            maxLength: null,
            pattern: null,
            baseValue: null,
            codes: [
                {codeName: 'HIGH', definition: 'High priority'},
                {codeName: 'NORM', definition: 'Normal priority'},
            ],
            constraints: [],
            currencyIdentifierSet: null,
            examples: [],
        })
    })
})

describe('parseRepository — constraints on message elements', () => {
    const xmlWithElementConstraints = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns:xmi="http://www.omg.org/XMI"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:iso20022="urn:iso:std:iso:20022:2013:ecore">
  <topLevelCatalogueEntry xsi:type="iso20022:BusinessArea"
      name="Payments" code="pacs" definition="Payments" registrationStatus="Registered">
  </topLevelCatalogueEntry>
  <topLevelDictionaryEntry xsi:type="iso20022:MessageComponent"
      xmi:id="message-component-1"
      name="SomeComponent"
      definition="Component">
    <messageElement xmi:id="message-element-1"
        name="Amount"
        xmlTag="Amt"
        definition="Amount"
        minOccurs="0"
        maxOccurs="1"
        simpleType="simple-type-1">
      <constraint name="ElemRule" definition="Element rule" expression="elem expr"/>
    </messageElement>
    <constraint name="CompRule" definition="Component rule" expression="comp expr"/>
  </topLevelDictionaryEntry>
  <topLevelDictionaryEntry xsi:type="iso20022:Text" xmi:id="simple-type-1" name="Max35Text" definition="text"/>
</model>`

    it('attaches constraints to the element, not the parent type', async () => {
        const repo = await parseRepository(makeFile(xmlWithElementConstraints))
        const ct = repo.dataTypes.get('message-component-1') as ComplexType
        expect(ct.constraints).toEqual([
            {name: 'CompRule', definition: 'Component rule', expression: 'comp expr'},
        ])
        expect(ct.elements[0]).toEqual({
            id: 'message-element-1',
            name: 'Amount',
            xmlTag: 'Amt',
            isAttribute: false,
            definition: 'Amount',
            minOccurs: 0,
            maxOccurs: 1,
            typeId: 'simple-type-1',
            constraints: [{name: 'ElemRule', definition: 'Element rule', expression: 'elem expr'}],
            examples: [],
        })
    })
})