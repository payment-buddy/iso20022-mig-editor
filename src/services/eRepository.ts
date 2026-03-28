import sax from 'sax'
import {unzipToStream} from "../utils/unzip.ts"
import type {
    BusinessArea,
    ComplexType,
    DataType,
    ERepository,
    MessageDefinition,
    MessageElement,
    Simpletype
} from "../types/types.ts"

export async function parseRepository(file: File): Promise<ERepository> {
    const parser = sax.parser(true) // strict mode — attribute names kept as-is

    const dataTypes = new Map<string, DataType>() // xmi:id → DataType
    const businessAreas: BusinessArea[] = []
    let businessArea: BusinessArea | null = null
    let complexType: ComplexType | null = null
    let simpleType: Simpletype | null = null
    let messageElement: MessageElement | null = null
    let messageDefinition: MessageDefinition | null = null
    let exampleText: string | null = null
    const num = (v: string | undefined) => v != null ? Number(v) : null
    const int = (v: string | undefined) => v != null ? parseInt(v, 10) : null

    parser.onopentag = (node: sax.Tag) => {
        if (node.name === 'example') {
            exampleText = ''
            return
        }

        const attrs = node.attributes
        const xsiType = attrs['xsi:type']

        if (node.name === 'topLevelCatalogueEntry') {
            if (xsiType === 'iso20022:BusinessArea') {
                if (attrs['registrationStatus'] !== 'Obsolete') {
                    businessArea = {
                        name: attrs['name'],
                        definition: attrs['definition'] ?? '',
                        code: attrs['code'] ?? ' ',
                        messages: [],
                    }
                }
            }
        } else if (node.name === 'topLevelDictionaryEntry') {
            if (xsiType === 'iso20022:MessageComponent' || xsiType === 'iso20022:ChoiceComponent') {
                complexType = {
                    name: attrs['name'],
                    definition: attrs['definition'] ?? '',
                    isChoice: xsiType === 'iso20022:ChoiceComponent',
                    elements: [],
                    constraints: [],
                }
                dataTypes.set(attrs['xmi:id'], complexType)
            } else if (xsiType === 'iso20022:BusinessComponent') {
                // skip
            } else {
                simpleType = {
                    name: attrs['name'],
                    definition: attrs['definition'] ?? '',
                    baseType: xsiType?.replace(/^iso20022:/, '') ?? null,
                    minInclusive: num(attrs['minInclusive']),
                    maxInclusive: num(attrs['maxInclusive']),
                    length: int(attrs['length']),
                    minLength: int(attrs['minLength']),
                    maxLength: int(attrs['maxLength']),
                    totalDigits: int(attrs['totalDigits']),
                    fractionDigits: int(attrs['fractionDigits']),
                    pattern: attrs['pattern'] ?? null,
                    baseValue: attrs['baseValue'] ?? null,
                    codes: [],
                    constraints: [],
                    examples: [],
                    currencyIdentifierSet: attrs['currencyIdentifierSet'] ?? null,
                }
                dataTypes.set(attrs['xmi:id'], simpleType)
            }
        }

        if (node.name === 'messageElement') {
            if (complexType) {
                messageElement = {
                    id: attrs['xmi:id'],
                    name: attrs['name'],
                    xmlTag: attrs['xmlTag'],
                    isAttribute: false,
                    definition: attrs['definition'] ?? '',
                    minOccurs: int(attrs['minOccurs']) ?? 1,
                    maxOccurs: int(attrs['maxOccurs']),
                    typeId: attrs['complexType'] ?? attrs['type'] ?? attrs['simpleType'],
                    constraints: [],
                    examples: [],
                }
                complexType.elements.push(messageElement)
            }
        } else if (node.name === 'messageDefinition') {
            if (businessArea && attrs['registrationStatus'] !== 'Obsolete') {
                messageDefinition = {
                    name: attrs['name'],
                    xmlTag: attrs['xmlTag'],
                    definition: attrs['definition'] ?? '',
                    identifier: '',
                    shortCode: '',
                    elements: [],
                    constraints: [],
                }
                businessArea.messages.push(messageDefinition)
            }
        } else if (node.name === 'messageBuildingBlock') {
            if (messageDefinition) {
                messageElement = {
                    id: attrs['xmi:id'],
                    name: attrs['name'],
                    xmlTag: attrs['xmlTag'] ?? '',
                    isAttribute: false,
                    definition: attrs['definition'] ?? '',
                    minOccurs: int(attrs['minOccurs']) ?? 1,
                    maxOccurs: int(attrs['maxOccurs']),
                    typeId: attrs['complexType'] ?? attrs['type'] ?? attrs['simpleType'],
                    constraints: [],
                    examples: [],
                }
                messageDefinition.elements.push(messageElement)
            }
        } else if (node.name === 'messageDefinitionIdentifier') {
            if (messageDefinition) {
                const {businessArea, messageFunctionality, flavour, version} = attrs
                messageDefinition.identifier = businessArea + '.' + messageFunctionality + '.' + flavour + '.' + version
                messageDefinition.shortCode = businessArea + '.' + messageFunctionality
            }
        } else if (node.name === 'code') {
            if (simpleType && attrs['codeName']) {
                simpleType.codes.push({
                    codeName: attrs['codeName'],
                    definition: attrs['definition'],
                })
            }
        } else if (node.name === 'constraint') {
            const constraint = {
                name: attrs['name'],
                definition: attrs['definition'],
                expression: attrs['expression'] ?? null,
            }
            if (messageElement) {
                messageElement.constraints.push(constraint)
            } else if (simpleType) {
                simpleType.constraints.push(constraint)
            } else if (complexType) {
                complexType.constraints.push(constraint)
            } else if (messageDefinition) {
                messageDefinition.constraints.push(constraint)
            }
        }
    }

    parser.ontext = (text) => {
        if (exampleText !== null) exampleText += text
    }

    parser.onclosetag = (name) => {
        if (name === 'example') {
            const value = exampleText?.trim()
            if (value) {
                if (messageElement) {
                    messageElement.examples.push(value)
                } else if (simpleType) {
                    simpleType.examples.push(value)
                }
            }
            exampleText = null
        } else if (name === 'topLevelDictionaryEntry') {
            complexType = null
            simpleType = null
        } else if (name === 'messageDefinition') {
            messageDefinition = null
        } else if (name === 'messageElement' || name === 'messageBuildingBlock') {
            messageElement = null
        } else if (name === 'topLevelCatalogueEntry' && businessArea) {
            businessAreas.push(businessArea)
            businessArea = null
        }
    }

    const stream = file.name.endsWith('.zip') ? unzipToStream(file) : file.stream()
    const reader = stream.getReader()
    const decoder = new TextDecoder('utf-8')
    while (true) {
        const {done, value} = await reader.read()
        if (done) break
        parser.write(decoder.decode(value, {stream: true}).replace(/&#xD;&#xA;/g, '&#xA;'))
    }
    parser.close()

    businessAreas.forEach(ba => ba.messages.sort((a, b) => a.identifier.localeCompare(b.identifier)))
    return {dataTypes, businessAreas}
}