import sax from 'sax'
import {unzipToStream} from "./unzip.ts";

export interface MessageElement {
    name: string
    xmlTag: string
    definition: string
    minOccurs: number,
    maxOccurs: number | null,
    isComplexTypeId: boolean,
    typeId: string
}

export interface Code {
    codeName: string
    definition: string
}

export interface DataType {
    name: string
    definition: string
}

export interface Simpletype extends DataType {
    minInclusive: string | null,
    maxInclusive: string | null,
    totalDigits: string | null,
    fractionDigits: string | null,
    length: string | null,
    minLength: string | null,
    maxLength: string | null,
    pattern: string | null
    baseValue: string | null,
    codes: Code[]
}

export interface IndicatorType extends DataType {
    meaningWhenTrue: string | null
    meaningWhenFalse: string | null
}

export interface ComplexType extends DataType {
    isChoice: boolean
    elements: MessageElement[]
}

export interface MessageBlock {
    name: string
    xmlTag: string
    definition: string
    minOccurs: string
    maxOccurs: string
    complexType: string | null
    simpleType: string | null
}

export interface MessageDefinition {
    name: string
    identifier: string
    shortCode: string
    definition: string
    xmlTag: string
    blocks: MessageBlock[]
}

export interface BusinessArea {
    name: string
    code: string
    definition: string
    messages: MessageDefinition[]
}

export interface ERepository {
    dataTypes: Map<string, DataType>
    businessAreas: BusinessArea[]
}

export async function parseRepository(file: File): Promise<ERepository> {
    const parser = sax.parser(true) // strict mode — attribute names kept as-is

    const dataTypes = new Map<string, DataType>() // xmi:id → DataType
    const businessAreas: BusinessArea[] = []
    let businessArea: BusinessArea | null = null
    let complexType: ComplexType | null = null
    let simpleType: Simpletype | null = null
    let messageDefinition: MessageDefinition | null = null

    parser.onopentag = (node: sax.Tag) => {
        const attrs = node.attributes
        const xsiType = attrs['xsi:type']

        if (node.name === 'topLevelCatalogueEntry') {
            if (xsiType === 'iso20022:BusinessArea') {
                if (attrs['registrationStatus'] !== 'Obsolete') {
                    businessArea = {
                        name: attrs['name'],
                        definition: attrs['definition'] || '',
                        code: attrs['code'] || ' ',
                        messages: [],
                    };
                }
            }
        } else if (node.name === 'topLevelDictionaryEntry') {
             if (xsiType === 'iso20022:MessageComponent' || xsiType === 'iso20022:ChoiceComponent') {
                complexType = {
                    name: attrs['name'],
                    definition: attrs['definition'] || '',
                    isChoice: xsiType === 'iso20022:ChoiceComponent',
                    elements: [],
                }
                dataTypes.set(attrs['xmi:id'], complexType)
            } else if (xsiType === 'iso20022:Indicator') {
                const indicatorType: IndicatorType = {
                    name: attrs['name'],
                    definition: attrs['definition'] || '',
                    meaningWhenFalse: attrs['meaningWhenFalse'] || null,
                    meaningWhenTrue: attrs['meaningWhenTrue'] || null,
                }
                dataTypes.set(attrs['xmi:id'], indicatorType)
            } else {
                simpleType = {
                    name: attrs['name'],
                    definition: attrs['definition'] || '',
                    minInclusive: attrs['minInclusive'],
                    maxInclusive: attrs['maxInclusive'],
                    length: attrs['length'],
                    minLength: attrs['minLength'],
                    maxLength: attrs['maxLength'],
                    totalDigits: attrs['totalDigits'],
                    fractionDigits: attrs['fractionDigits'],
                    pattern: attrs['pattern'],
                    baseValue: attrs['baseValue'],
                    codes: [],
                }
                dataTypes.set(attrs['xmi:id'], simpleType)
            }
        }

        if (node.name === 'messageElement') {
            if (complexType) {
                complexType.elements.push({
                    name: attrs['name'],
                    xmlTag: attrs['xmlTag'],
                    definition: attrs['definition'] ?? '',
                    minOccurs: parseInt(attrs['minOccurs']) ?? 0,
                    maxOccurs: parseInt(attrs['maxOccurs']) ?? null,
                    isComplexTypeId: !!attrs['complexType'],
                    typeId: attrs['simpleType'] ?? attrs['complexType'],
                })
            }
        } else if (node.name === 'messageDefinition') {
            if (businessArea && attrs['registrationStatus'] !== 'Obsolete') {
                messageDefinition = {
                    name: attrs['name'],
                    xmlTag: attrs['xmlTag'],
                    definition: attrs['definition'] || '',
                    identifier: '',
                    shortCode: '',
                    blocks: [],
                }
                businessArea.messages.push(messageDefinition)
            }
        } else if (node.name === 'messageBuildingBlock') {
            if (messageDefinition) {
                messageDefinition.blocks.push({
                    name: attrs['name'],
                    xmlTag: attrs['xmlTag'] || '',
                    definition: attrs['definition'] || '',
                    minOccurs: attrs['minOccurs'] ?? '1',
                    maxOccurs: attrs['maxOccurs'] ?? '1',
                    complexType: attrs['complexType'] || null,
                    simpleType: attrs['simpleType'] || null,
                })
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
        }
    }

    parser.onclosetag = (name) => {
        if (name === 'topLevelDictionaryEntry') {
            complexType = null
        } else if (name === 'messageDefinition') {
            messageDefinition = null
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
        parser.write(decoder.decode(value, {stream: true}))
    }
    parser.close()

    return {dataTypes, businessAreas}
}
