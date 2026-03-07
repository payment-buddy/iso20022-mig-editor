import sax from 'sax'
import {unzipToStream} from "./unzip.ts";
import type {BusinessArea, ComplexType, DataType, ERepository, MessageDefinition, Simpletype} from "./types.ts";

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
            } else {
                const num = (v: string | undefined) => v != null ? Number(v) : null
                const int = (v: string | undefined) => v != null ? parseInt(v, 10) : null
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
                }
                dataTypes.set(attrs['xmi:id'], simpleType)
            }
        }

        if (node.name === 'messageElement') {
            if (complexType) {
                complexType.elements.push({
                    id: attrs['xmi:id'],
                    name: attrs['name'],
                    xmlTag: attrs['xmlTag'],
                    definition: attrs['definition'] ?? '',
                    minOccurs: parseInt(attrs['minOccurs'] ?? '1', 10),
                    maxOccurs: parseInt(attrs['maxOccurs'] ?? '1', 10),
                    typeId: attrs['complexType'] ?? attrs['type'] ?? attrs['simpleType'],
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
                    elements: [],
                }
                businessArea.messages.push(messageDefinition)
            }
        } else if (node.name === 'messageBuildingBlock') {
            if (messageDefinition) {
                messageDefinition.elements.push({
                    id: attrs['xmi:id'],
                    name: attrs['name'],
                    xmlTag: attrs['xmlTag'] ?? '',
                    definition: attrs['definition'] ?? '',
                    minOccurs: parseInt(attrs['minOccurs'] ?? '1', 10),
                    maxOccurs: parseInt(attrs['maxOccurs'] ?? '1', 10),
                    typeId: attrs['complexType'] ?? attrs['type'] ?? attrs['simpleType'],
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
            simpleType = null
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