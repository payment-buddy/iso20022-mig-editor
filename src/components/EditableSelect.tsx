import {useEffect, useRef, useState} from 'react'
import {WarningIcon} from "./WarningIcon.tsx"

export function EditableSelect({
    value,
    options,
    onSave,
    placeholder = '<none>',
    originalValue,
    warning
}: {
    value: string | null
    options: { value: string, name: string }[]
    onSave: (value: string | null) => void
    placeholder?: string
    originalValue?: string | null
    warning?: string
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState<string | null>(null)
    const [hovered, setHovered] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const selectRef = useRef<HTMLSelectElement>(null)
    const spanRef = useRef<HTMLSpanElement>(null)

    const selectedOption = options.find(o => o.value === value)
    const displayValue = value ? (selectedOption?.name ?? `${value} (Missing)`) : placeholder
    const isMissing = !!value && !selectedOption
    const isOverridden = originalValue !== undefined && value !== originalValue

    function handleDraftChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const newDraft = e.target.value === '' ? null : e.target.value
        setDraft(newDraft)
    }

    function startEdit() {
        setDraft(value)
        setHovered(false)
        setEditing(true)
    }

    function save() {
        onSave(draft)
        setEditing(false)
        setHovered(true)
    }

    function cancel() {
        setDraft(value)
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
                setDraft(value)
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
                        width: '100%',
                    }}
                >
                    <option value="">{placeholder}</option>
                    {options.map(p => (
                        <option key={p.value} value={p.value}>{p.name}</option>
                    ))}
                    {originalValue && !options.some(o => o.value === originalValue) && (
                        <option value={originalValue}>{originalValue} (Missing)</option>
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
            <span ref={spanRef}>
                <span 
                    title={isOverridden ? `was: ${originalValue ?? '<none>'}` : undefined}
                    className={isOverridden ? 'is-overridden' : undefined}
                    style={{
                        padding: '4px 4px 0 4px',
                        minWidth: '1em',
                        color: isMissing ? 'red' : 'inherit'
                    }}
                >
                    {displayValue}
                </span>
                {warning && <WarningIcon title={warning} style={{marginLeft: '4px'}}/>}
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
