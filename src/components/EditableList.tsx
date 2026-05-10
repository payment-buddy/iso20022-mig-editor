import {useEffect, useRef, useState} from 'react'
import {WarningIcon} from "./WarningIcon.tsx"

export function EditableList({values, originalValues, validateValue, onSave}: {
    values: string[]
    originalValues: string[]
    validateValue?: (value: string) => string | null
    onSave: (values: string[]) => void
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(values.join('\n'))
    const [hovered, setHovered] = useState(false)
    const [initialHeight, setInitialHeight] = useState<number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
    const divRef = useRef<HTMLDivElement>(null)
    const isOverridden = JSON.stringify(values) !== JSON.stringify(originalValues)

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus()
            if (inputRef.current instanceof HTMLInputElement) {
                inputRef.current.select()
            }
        }
    }, [editing])

    useEffect(() => {
        if (!editing) return
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setDraft(values.join('\n'))
                setEditing(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [editing, values])

    const startEdit = () => {
        if (divRef.current) {
            setInitialHeight(divRef.current.offsetHeight)
        }
        setDraft(values.join('\n'))
        setHovered(false)
        setEditing(true)
    }

    const save = () => {
        const newValues = draft.split('\n').map(s => s.trim()).filter(Boolean)
        onSave(newValues)
        setEditing(false)
        setHovered(true)
    }

    const cancel = () => {
        setDraft(values.join('\n'))
        setEditing(false)
        setHovered(true)
    }

    const revert = () => {
        setDraft(originalValues.join('\n'))
    }

    if (editing) {
        return (
            <div ref={containerRef} style={{display: 'flex', alignItems: 'flex-start'}}>
                    <textarea ref={inputRef as React.Ref<HTMLTextAreaElement>}
                              value={draft}
                              onChange={e => setDraft(e.target.value)}
                              onKeyDown={e => {
                                  if (e.key === 'Escape') cancel()
                              }}
                              style={{
                                  width: '100%',
                                  resize: 'vertical',
                                  minHeight: initialHeight ? `${initialHeight}px` : '4em',
                                  fontFamily: 'monospace',
                                  fontSize: 'inherit',
                                  lineHeight: 'inherit'
                              }}/>
                <button title="Save" onClick={save}>&#x2713;</button>
                <button title="Cancel" onClick={cancel}>&#x2715;</button>
                {JSON.stringify(draft) !== JSON.stringify(originalValues) &&
                    <button title="Revert" onClick={revert}>&#x21BA;</button>}
            </div>
        )
    }

    return (
        <div style={{display: 'flex', alignItems: 'flex-start'}} onMouseEnter={() => setHovered(true)}
             onMouseLeave={() => setHovered(false)}>
            <div ref={divRef} title={isOverridden ? 'was: ' + originalValues.join('\n') : undefined}
                 className={isOverridden ? 'is-overridden' : undefined}
                 style={{cursor: 'pointer'}}
            >
                {values.length === 0 ? (
                    <span style={{color: '#888'}}>&lt;none&gt;</span>
                ) : (
                    values.map((value, i) => {
                        const warning = validateValue?.(value)
                        return (
                            <div key={i}>
                                {value || '<empty>'}
                                {warning && <WarningIcon title={warning} style={{marginLeft: '1em'}}/>}
                            </div>
                        )
                    })
                )}
            </div>
            <button title="Edit" onClick={startEdit}
                    style={{
                        visibility: hovered ? 'visible' : 'hidden',
                        maxHeight: '2em',
                        marginLeft: '4px'
                    }}>&#9998;</button>
        </div>
    )
}
