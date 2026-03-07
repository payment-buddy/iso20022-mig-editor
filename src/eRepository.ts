import sax from 'sax'

export interface BusinessArea {
    name: string
    code: string
    definition: string
}

export interface ERepository {
    businessAreas: BusinessArea[]
}

export async function parseRepository(source: File): Promise<ERepository> {
    const parser = sax.parser(true) // strict mode — attribute names kept as-is

    const businessAreas: BusinessArea[] = []

    parser.onopentag = (node) => {
        const attrs = (node as sax.Tag).attributes
        const xsiType = attrs['xsi:type']

        if (xsiType === 'iso20022:BusinessArea') {
            if (attrs['registrationStatus'] === 'Registered') {
                const businessArea: BusinessArea = {
                    name: attrs['name'],
                    code: attrs['code'],
                    definition: attrs['definition'] || '',
                }
                businessAreas.push(businessArea)
            }
        }
    }

    const stream = typeof source.stream === 'function' ? source.stream() : source as unknown as ReadableStream<Uint8Array>
    const reader = stream.getReader()
    const decoder = new TextDecoder('utf-8')

    while (true) {
        const {done, value} = await reader.read()
        if (done) break
        parser.write(decoder.decode(value, {stream: true}))
    }

    parser.close()

    return {businessAreas}
}
