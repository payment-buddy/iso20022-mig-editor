import sax from 'sax'
import {unzipToStream} from "./unzip.ts";
import type {
    BusinessArea,
    ComplexType,
    DataType,
    ERepository,
    IndicatorType,
    MessageDefinition,
    Simpletype
} from "./types.ts";

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
                        definition: attrs['definition'] ?? '',
                        code: attrs['code'] ?? ' ',
                        messages: [],
                    };
                }
            }
        } else if (node.name === 'topLevelDictionaryEntry') {
             if (xsiType === 'iso20022:MessageComponent' || xsiType === 'iso20022:ChoiceComponent') {
                complexType = {
                    name: attrs['name'],
                    definition: attrs['definition'] ?? '',
                    isChoice: xsiType === 'iso20022:ChoiceComponent',
                    elements: [],
                }
                dataTypes.set(attrs['xmi:id'], complexType)
            } else if (xsiType === 'iso20022:Indicator') {
                const indicatorType: IndicatorType = {
                    name: attrs['name'],
                    definition: attrs['definition'] ?? '',
                    meaningWhenFalse: attrs['meaningWhenFalse'] ?? null,
                    meaningWhenTrue: attrs['meaningWhenTrue'] ?? null,
                }
                dataTypes.set(attrs['xmi:id'], indicatorType)
            } else {
                simpleType = {
                    name: attrs['name'],
                    definition: attrs['definition'] ?? '',
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
                    minOccurs: attrs['minOccurs'] ?? '1',
                    maxOccurs: attrs['maxOccurs'] ?? '1',
                    complexTypeId: attrs['complexType'] ?? null,
                    simpleTypeId: attrs['simpleType'] ?? null,
                })
            }
        } else if (node.name === 'messageDefinition') {
            if (businessArea && attrs['registrationStatus'] !== 'Obsolete') {
                messageDefinition = {
                    name: attrs['name'],
                    xmlTag: attrs['xmlTag'],
                    definition: attrs['definition'] ?? '',
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
                    xmlTag: attrs['xmlTag'] ?? '',
                    definition: attrs['definition'] ?? '',
                    minOccurs: attrs['minOccurs'] ?? '1',
                    maxOccurs: attrs['maxOccurs'] ?? '1',
                    complexTypeId: attrs['complexType'] ?? null,
                    simpleTypeId: attrs['simpleType'] ?? null,
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
