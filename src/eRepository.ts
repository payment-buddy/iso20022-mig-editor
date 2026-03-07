import sax from 'sax'
import {unzipToStream} from "./unzip.ts";

export interface MessageDefinition {
    name: string
    identifier: string
    shortCode: string
    definition: string
    xmlTag: string
}

export interface BusinessArea {
    name: string
    code: string
    definition: string
    messages: MessageDefinition[]
}

export interface ERepository {
    businessAreas: BusinessArea[]
}

export async function parseRepository(file: File): Promise<ERepository> {
    const parser = sax.parser(true) // strict mode — attribute names kept as-is

    const businessAreas: BusinessArea[] = []
    let businessArea: BusinessArea | null = null
    let messageDefinition: MessageDefinition | null = null

    parser.onopentag = (node: sax.Tag) => {
        const attrs = node.attributes
        const xsiType = attrs['xsi:type']

        if (xsiType === 'iso20022:BusinessArea') {
            if (attrs['registrationStatus'] === 'Registered') {
                businessArea = {
                    name: attrs['name'],
                    code: attrs['code'],
                    definition: attrs['definition'] || '',
                    messages: [],
                }
            }
        } else if (node.name === 'messageDefinition') {
            if (attrs['registrationStatus'] === 'Registered') {
                messageDefinition = {
                    name: attrs['name'],
                    xmlTag: attrs['xmlTag'],
                    definition: attrs['definition'] || '',
                    identifier: '',
                    shortCode: '',
                }
            }
        } else if (node.name === 'messageDefinitionIdentifier' && messageDefinition) {
            const {businessArea, messageFunctionality, flavour, version} = attrs
            messageDefinition.identifier = [businessArea, messageFunctionality, flavour, version]
                .join('.')
            messageDefinition.shortCode = businessArea + '.' + messageFunctionality
        }
    }

    parser.onclosetag = (name) => {
        if (name === 'messageDefinition' && messageDefinition && businessArea) {
            businessArea.messages.push(messageDefinition)
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

    if (businessArea != null) {
        throw new Error('XML is truncated')
    }
    return {businessAreas}
}
