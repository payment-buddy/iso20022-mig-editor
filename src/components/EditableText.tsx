/* eslint-disable react-hooks/set-state-in-effect */
import {useState, useRef, useEffect} from "react"

export function EditableText({value, originalValue, multiline, monospace, autoFocus, onSave}: {
    value: string
    originalValue?: string
    multiline?: boolean
    monospace?: boolean
    autoFocus?: boolean
    onSave: (value: string) => void
}) {
    const isOverridden = originalValue != undefined && value !== originalValue
    const [editing, setEditing] = useState(false)
    const [inputValue, setInputValue] = useState('')
    const autoFocusTriggered = useRef(false)

    useEffect(() => {
        if (autoFocus && !autoFocusTriggered.current) {
            autoFocusTriggered.current = true
            setInputValue(value)
            setEditing(true)
        }
    }, [autoFocus, value])

    function startEdit() {
        setInputValue(value)
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
                    style={{resize: 'vertical', minHeight: '4em', width: '100%'}}
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
                style={{width: '100%', ...(monospace ? {fontFamily: 'monospace'} : {})}}
            />
        )
    }

    return (
        <span
            title={isOverridden ? `Original: ${originalValue ?? '<none>'}` : undefined}
            style={{
                cursor: 'pointer',
                ...(multiline ? {whiteSpace: 'pre-wrap'} : {}),
                ...(monospace ? {fontFamily: 'monospace'} : {}),
                ...(isOverridden ? {color: '#0066cc'} : {}),
            }}
            onClick={startEdit}
        >
            {value || '<none>'}
        </span>
    )
}
