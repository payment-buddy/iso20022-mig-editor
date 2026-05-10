import {stringify} from 'yaml'
import type {MessageImplementationGuide} from "../types/types.ts"
import {prepareForDownload} from "../utils/migUtils.ts"

export function ComparePage({migA, migB}: {
    migA: MessageImplementationGuide
    migB: MessageImplementationGuide
}) {
    const yamlA = stringify(prepareForDownload(migA), (_key, val) => {
        if (val === null) return undefined
        if (Array.isArray(val) && val.length === 0) return undefined
        return val
    })
    const yamlB = stringify(prepareForDownload(migB), (_key, val) => {
        if (val === null) return undefined
        if (Array.isArray(val) && val.length === 0) return undefined
        return val
    })

    return (
        <div>
            <a href="#" className="back-link">← Back</a>
            <div className="page-header">
                <h2>Compare MIGs</h2>
            </div>
            <div style={{display: 'flex', gap: '1em'}}>
                <div style={{flex: 1}}>
                    <h3>{migA.name}:{migA.version}</h3>
                    <pre style={{whiteSpace: 'pre-wrap', fontSize: '0.85em'}}>{yamlA}</pre>
                </div>
                <div style={{flex: 1}}>
                    <h3>{migB.name}:{migB.version}</h3>
                    <pre style={{whiteSpace: 'pre-wrap', fontSize: '0.85em'}}>{yamlB}</pre>
                </div>
            </div>
        </div>
    )
}
