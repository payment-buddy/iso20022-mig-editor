import {useEffect, useRef, useState} from 'react'
import {WarningIcon} from "./WarningIcon.tsx"

export function EditableField({value, originalValue, onSave, warning, inputType = 'text'}: {
    value?: string | null
    originalValue?: string | null
    onSave: (value: string) => void
    warning?: string
    inputType?: 'text' | 'number' | 'textarea'
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value ?? '')
    const [hovered, setHovered] = useState(false)
    const [initialHeight, setInitialHeight] = useState<number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
    const spanRef = useRef<HTMLSpanElement>(null)
    const isTextarea = inputType === 'textarea'
    const isOverridden = value !== originalValue

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
                setDraft(value ?? '')
                setEditing(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [editing, value])

    const startEdit = () => {
        if (spanRef.current) {
            setInitialHeight(spanRef.current.offsetHeight)
        }
        setDraft(value ?? '')
        setHovered(false)
        setEditing(true)
    }

    const save = () => {
        onSave(draft)
        setEditing(false)
        setHovered(true)
    }

    const cancel = () => {
        setDraft(value ?? '')
        setEditing(false)
        setHovered(true)
    }

    const revert = () => {
        setDraft(originalValue ?? '')
    }

    if (editing) {
        return (
            <div ref={containerRef} style={isTextarea ? {display: 'flex', alignItems: 'flex-start'} : undefined}>
                {isTextarea ? (
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
                                  fontFamily: 'inherit',
                                  fontSize: 'inherit',
                                  lineHeight: 'inherit'
                              }}/>
                ) : (
                    <input type={inputType}
                           ref={inputRef as React.Ref<HTMLInputElement>}
                           value={draft}
                           min="0"
                           onChange={e => setDraft(e.target.value)}
                           onKeyDown={e => {
                               if (e.key === 'Enter') save()
                               if (e.key === 'Escape') cancel()
                           }}/>
                )}
                <button title="Save" onClick={save}>&#x2713;</button>
                <button title="Cancel" onClick={cancel}>&#x2715;</button>
                {draft !== originalValue && <button title="Revert" onClick={revert}>&#x21BA;</button>}
            </div>
        )
    }

    return (
        <div style={{display: 'flex', alignItems: 'flex-start'}} onMouseEnter={() => setHovered(true)}
             onMouseLeave={() => setHovered(false)}>
            <span ref={spanRef}>
                <span title={isOverridden ? `was: ${originalValue ?? '<none>'}` : undefined}
                      className={isOverridden ? 'is-overridden' : undefined}
                      style={{
                          whiteSpace: isTextarea ? 'pre-wrap' : undefined,
                          padding: '4px 4px 0 4px',
                          minWidth: '1em',
                      }}>{(value ?? <span style={{color: '#888'}}>&lt;none&gt;</span>) || '<empty>'}</span>
                {warning && <WarningIcon title={warning} style={{marginLeft: '4px'}}/>}
            </span>
            <button title="Edit" onClick={startEdit}
                    style={{
                        visibility: hovered ? 'visible' : 'hidden',
                        maxHeight: '2em',
                        marginLeft: '4px'
                    }}>&#9998;</button>
        </div>
    )
}
