import {stringify} from 'yaml'

export async function downloadYaml(obj: unknown, filename: string) {
    const yaml = stringify(obj, (_key, val) => {
        if (val === null) return undefined
        if (Array.isArray(val) && val.length === 0) return undefined
        return val
    })

    // new API that allows to avoid adding (1) to suggested file name if the file exists.
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'YAML Files',
                    accept: {'text/yaml': ['.yaml']}
                }]
            })
            const writable = await handle.createWritable()
            await writable.write(yaml)
            await writable.close()
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return
            }
            throw err
        }
    }

    // Fallback to old API
    const blob = new Blob([yaml], {type: 'text/yaml'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}
