import {useCallback, useState} from "react"
import type {MessageImplementationGuide} from "../types/types.ts"
import {FileInputButton} from "../components/FileInputButton.tsx"
import {GithubLink} from "../components/GithubLink.tsx"

import {downloadYaml} from "../utils/downloadYaml.ts"
import {getMigKey, prepareForDownload} from "../utils/migUtils.ts"
import {ConfirmDeleteModal} from "../components/ConfirmDeleteModal.tsx"

export function MigListPage({migs, onBrowse, onUpload, onDelete}: {
    migs: MessageImplementationGuide[]
    onBrowse: () => void
    onUpload: (text: string) => void
    onDelete: (key: string) => void
}) {
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    const handleToggle = useCallback((key: string) => {
        setSelectedKeys(prev => {
            const next = new Set(prev)
            if (next.has(key)) {
                next.delete(key)
            } else {
                next.add(key)
            }
            return next
        })
    }, [])

    const handleToggleAll = useCallback(() => {
        setSelectedKeys(prev => {
            if (prev.size === migs.length) return new Set()
            return new Set(migs.map(getMigKey))
        })
    }, [migs])

    const handleDownloadSelected = useCallback(async () => {
        const items = migs.filter(m => selectedKeys.has(getMigKey(m)))
        if (items.length === 1) {
            await downloadYaml(prepareForDownload(items[0]), `${items[0].name}.yaml`)
        } else {
            await downloadYaml(prepareForDownload(items), 'MessageImplementationGuides.yaml')
        }
    }, [migs, selectedKeys])

    const handleDeleteSelected = useCallback(() => {
        setShowDeleteModal(true)
    }, [])

    const confirmDeleteSelected = useCallback(() => {
        for (const key of selectedKeys) {
            onDelete(key)
        }
        setSelectedKeys(new Set())
        setShowDeleteModal(false)
    }, [selectedKeys, onDelete])

    return (
        <div>
            <div className="page-header">
                <h2>ISO 20022 Message Implementation Guide</h2>
                <div className="page-actions">
                    <FileInputButton label="Upload MIG" accept=".yaml,.yml" onFile={f => f.text().then(onUpload)}/>
                    <button onClick={onBrowse}>Browse e-Repository</button>
                    <GithubLink/>
                </div>
            </div>
            <div className="page-actions">
                <button onClick={handleDownloadSelected}
                        disabled={selectedKeys.size === 0}>Download {selectedKeys.size > 1 && <>({selectedKeys.size})</>}</button>
                <button onClick={handleDeleteSelected}
                        disabled={selectedKeys.size === 0}>Delete {selectedKeys.size > 1 && <>({selectedKeys.size})</>}</button>
                <button onClick={() => {
                    const keys = [...selectedKeys]
                    if (keys.length === 2) window.location.hash = 'compare/' + keys.map(encodeURIComponent).join('/')
                }} disabled={selectedKeys.size !== 2}>Compare</button>
            </div>

            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                <tr style={{textAlign: 'left', borderBottom: '2px solid'}}>
                    <th style={{width: '30px'}}>
                        <input
                            type="checkbox"
                            checked={migs.length > 0 && selectedKeys.size === migs.length}
                            onChange={handleToggleAll}
                        />
                    </th>
                    <th>Name</th>
                    <th>Version</th>
                </tr>
                </thead>
                <tbody>
                {migs.map(mig => {
                    const key = getMigKey(mig)
                    return (
                        <tr key={key} style={{borderBottom: '1px solid'}}>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={selectedKeys.has(key)}
                                    onChange={() => handleToggle(key)}
                                />
                            </td>
                            <td><a href={'#mig/' + encodeURIComponent(key)}>{mig.name}</a></td>
                            <td>{mig.version}</td>
                        </tr>
                    )
                })}
                </tbody>
            </table>
            {showDeleteModal && (() => {
                const items = migs.filter(m => selectedKeys.has(getMigKey(m)))
                const itemName = items.length === 1 ? items[0].name : `${items.length} selected MIGs`
                return (
                    <ConfirmDeleteModal
                        onClose={() => setShowDeleteModal(false)}
                        onConfirm={() => confirmDeleteSelected()}
                        onDownloadBackup={() => handleDownloadSelected()}
                        itemName={itemName}
                    />
                )
            })()}
        </div>
    )
}
