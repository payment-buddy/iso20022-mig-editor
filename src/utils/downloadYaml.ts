import {stringify} from 'yaml'

export function downloadYaml(obj: unknown, filename: string) {
    const yaml = stringify(obj, (_key, val) => {
        if (val === null) return undefined
        if (Array.isArray(val) && val.length === 0) return undefined
        return val
    })
    const blob = new Blob([yaml], {type: 'text/yaml'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}
