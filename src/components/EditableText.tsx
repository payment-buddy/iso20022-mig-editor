import {useEffect, useRef, useState} from "react"

export function EditableText({value, originalValue, multiline, monospace, autoFocus, onSave}: {
    value: string | null
    originalValue?: string
    multiline?: boolean
    monospace?: boolean
    autoFocus?: boolean
    onSave: (value: string) => void
}) {
    const isOverridden = originalValue != undefined && value !== originalValue
    const [editing, setEditing] = useState(false)
    const [inputValue, setInputValue] = useState('')
    const [initialHeight, setInitialHeight] = useState<number | null>(null)
    const autoFocusTriggered = useRef(false)
    const spanRef = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        if (autoFocus && !autoFocusTriggered.current) {
            autoFocusTriggered.current = true
            setInputValue(value ?? '')
            setEditing(true)
        }
    }, [autoFocus, value])

    function startEdit() {
        if (spanRef.current) {
            setInitialHeight(spanRef.current.offsetHeight)
        }
        setInputValue(value ?? '')
        setEditing(true)
    }

    function save() {
        setEditing(false)
        onSave(inputValue.trim())
    }

    if (editing) {
        if (multiline) {
            return (
                <textarea
                    autoFocus
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onBlur={save}
                    onKeyDown={e => {
                        if (e.key === 'Escape') setEditing(false)
                    }}
                    style={{
                        resize: 'vertical',
                        minHeight: initialHeight ? `${initialHeight}px` : '4em',
                        width: '100%',
                        fontFamily: monospace ? 'monospace' : 'inherit',
                        fontSize: 'inherit',
                        lineHeight: 'inherit'
                    }}
                />
            )
        }
        return (
            <input
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onBlur={save}
                onKeyDown={e => {
                    if (e.key === 'Enter') save()
                    if (e.key === 'Escape') setEditing(false)
                }}
                style={{
                    width: '100%',
                    fontFamily: monospace ? 'monospace' : 'inherit',
                    fontSize: 'inherit',
                    lineHeight: 'inherit'
                }}
            />
        )
    }

    return (
        <span
            ref={spanRef}
            title={isOverridden ? `Original: ${originalValue ?? '<none>'}` : undefined}
            className={isOverridden ? 'is-overridden' : undefined}
            style={{
                cursor: 'pointer',
                ...(multiline ? {whiteSpace: 'pre-wrap'} : {}),
                fontFamily: monospace ? 'monospace' : 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
            }}
            onClick={startEdit}
        >
            {value || '<none>'}
        </span>
    )
}
