import {Unzip, UnzipInflate} from 'fflate'

export function unzipToStream(zipFile: File): ReadableStream<Uint8Array> {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
        start(c) {
            controller = c
        }
    })
    const unzipper = new Unzip()
    unzipper.register(UnzipInflate)
    let found = false

    unzipper.onfile = (entry) => {
        if (!entry.name.endsWith('.iso20022')) return
        found = true
        entry.ondata = (err, data, final) => {
            if (err) {
                controller.error(err);
                return
            }
            controller.enqueue(data)
            if (final) controller.close()
        }
        entry.start()
    }

    ;(async () => {
        const reader = zipFile.stream().getReader()
        try {
            while (true) {
                const {done, value} = await reader.read()
                if (done) {
                    unzipper.push(new Uint8Array(0), true)
                    if (!found) controller.error(new Error(`*.iso20022 not found in ZIP`))
                    break
                }
                unzipper.push(value)
            }
        } catch (err) {
            controller.error(err)
        }
    })()

    return stream
}
