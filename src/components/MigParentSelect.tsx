import {useEffect, useRef, useState} from 'react'
import {WarningIcon} from "./WarningIcon.tsx"
import {getMigKey} from "../utils/migUtils.ts"
import type {MessageImplementationGuide} from "../types/types.ts"

export function MigParentSelect({
    value,
    migs,
    onSave,
    originalValue,
}: {
    value: string | undefined
    migs: MessageImplementationGuide[]
    onSave: (value: string | undefined) => void
    originalValue?: string
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState<string | null>(null)
    const [hovered, setHovered] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const selectRef = useRef<HTMLSelectElement>(null)

    const selectedOption = value ? migs.find(m => getMigKey(m) === value) : undefined
    const isMissing = value !== undefined && !selectedOption
    const isOverridden = originalValue !== undefined && value !== originalValue

    function handleDraftChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const newDraft = e.target.value === '' ? null : e.target.value
        setDraft(newDraft)
    }

    function startEdit() {
        setDraft(value ?? null)
        setHovered(false)
        setEditing(true)
    }

    function save() {
        onSave(draft ?? undefined)
        setEditing(false)
        setHovered(true)
    }

    function cancel() {
        setDraft(value ?? null)
        setEditing(false)
        setHovered(true)
    }

    function revert() {
        if (originalValue !== undefined) {
            setDraft(originalValue)
        }
    }

    useEffect(() => {
        if (editing) {
            selectRef.current?.focus()
        }
    }, [editing])

    useEffect(() => {
        if (!editing) return
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setDraft(value ?? null)
                setEditing(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [editing, value])

    if (editing) {
        return (
            <div ref={containerRef} style={{display: 'flex', alignItems: 'flex-start'}}>
                <select
                    ref={selectRef}
                    value={draft ?? ''}
                    onChange={handleDraftChange}
                    onKeyDown={e => {
                        if (e.key === 'Enter') save()
                        if (e.key === 'Escape') cancel()
                    }}
                    style={{
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                    }}
                >
                    <option value="">&lt;none&gt;</option>
                    {migs.map(m => {
                        const key = getMigKey(m)
                        return <option key={key} value={key}>{key}</option>
                    })}
                    {value && !migs.some(m => getMigKey(m) === value) && (
                        <option value={value}>{value} (Missing)</option>
                    )}
                </select>
                <button title="Save" onClick={save}>&#x2713;</button>
                <button title="Cancel" onClick={cancel}>&#x2715;</button>
                {draft !== originalValue && <button title="Revert" onClick={revert}>&#x21BA;</button>}
            </div>
        )
    }

    return (
        <div
            style={{display: 'flex', alignItems: 'flex-start'}}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <span>
                {value && selectedOption ? (
                    <a
                        href={'#mig/' + encodeURIComponent(value)}
                        title={isOverridden ? `was: ${originalValue ?? '<none>'}` : undefined}
                        className={isOverridden ? 'is-overridden' : undefined}
                        style={{padding: '4px 4px 0 4px', display: 'inline-block'}}
                    >
                        {value}
                    </a>
                ) : (
                    <span
                        title={isOverridden ? `was: ${originalValue ?? '<none>'}` : undefined}
                        className={isOverridden ? 'is-overridden' : undefined}
                        style={{
                            padding: '4px 4px 0 4px',
                            minWidth: '1em',
                            color: isMissing ? 'red' : 'inherit'
                        }}
                    >
                        {isMissing ? (
                            <>{value} (missing)</>
                        ) : (
                            <span style={{color: '#888'}}>&lt;none&gt;</span>
                        )}
                    </span>
                )}
                {isMissing && <WarningIcon title="The selected parent MIG was not found. Please upload it." style={{marginLeft: '4px'}}/>}
            </span>
            <button
                title="Edit"
                onClick={startEdit}
                style={{
                    visibility: hovered ? 'visible' : 'hidden',
                    maxHeight: '2em',
                    marginLeft: '4px'
                }}
            >&#9998;</button>
        </div>
    )
}
