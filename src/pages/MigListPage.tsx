import {useCallback, useState} from "react"
import type {MessageImplementationGuide} from "../types/types.ts"
import {FileInputButton} from "../components/FileInputButton.tsx"

import {downloadYaml} from "../utils/downloadYaml.ts"

export function MigListPage({migs, onBrowse, onUpload}: {
    migs: MessageImplementationGuide[]
    onBrowse: () => void
    onUpload: (text: string) => void
}) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const handleToggle = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }, [])

    const handleToggleAll = useCallback(() => {
        setSelectedIds(prev => {
            if (prev.size === migs.length) return new Set()
            return new Set(migs.map(m => m.id))
        })
    }, [migs])

    const handleDownloadSelected = useCallback(() => {
        const items = migs.filter(m => selectedIds.has(m.id))
        if (items.length === 1) {
            downloadYaml(items[0], `${items[0].name}.yaml`)
        } else {
            downloadYaml(items, 'MessageImplementationGuides.yaml')
        }
    }, [migs, selectedIds])

    return (
        <div>
            <div className="page-header">
                <h2>ISO 20022 Message Implementation Guide</h2>
                <div className="page-actions">
                    <button onClick={handleDownloadSelected} disabled={selectedIds.size === 0}>Download ({selectedIds.size})</button>
                    <FileInputButton label="Load MIG" accept=".yaml,.yml" onFile={f => f.text().then(onUpload)}/>
                    <button onClick={onBrowse}>Browse e-Repository</button>
                </div>
            </div>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                <tr style={{textAlign: 'left', borderBottom: '2px solid'}}>
                    <th style={{width: '30px'}}>
                        <input
                            type="checkbox"
                            checked={migs.length > 0 && selectedIds.size === migs.length}
                            onChange={handleToggleAll}
                        />
                    </th>
                    <th>Name</th>
                    <th>Version</th>
                </tr>
                </thead>
                <tbody>
                {migs.map(mig => (
                    <tr key={mig.id} style={{borderBottom: '1px solid'}}>
                        <td>
                            <input
                                type="checkbox"
                                checked={selectedIds.has(mig.id)}
                                onChange={() => handleToggle(mig.id)}
                            />
                        </td>
                        <td><a href={'#mig/' + mig.id}>{mig.name}</a></td>
                        <td>{mig.version}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    )
}
