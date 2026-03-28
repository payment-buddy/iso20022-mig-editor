import {useState} from "react";

export function EditableValueList({values, isOverridden, monospace, isValueInvalid, onSave}: {
    values: string[]
    isOverridden: boolean
    monospace?: boolean
    isValueInvalid?: (value: string) => boolean
    onSave: (values: string[]) => void
}) {
    const [editing, setEditing] = useState(false)
    const [inputValue, setInputValue] = useState('')

    function startEdit() {
        setInputValue(values.join('\n'))
        setEditing(true)
    }

    function save() {
        setEditing(false)
        const newValues = inputValue.split('\n').map(s => s.trim()).filter(Boolean)
        onSave(newValues)
    }

    if (editing) {
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
                    minHeight: '4em',
                    width: '100%',
                    ...(monospace ? {fontFamily: 'monospace'} : {}),
                }}
            />
        )
    }

    return (
        <div
            style={{
                cursor: 'pointer',
                ...(monospace ? {fontFamily: 'monospace'} : {}),
                ...(isOverridden ? {color: '#0066cc'} : {}),
            }}
            onClick={startEdit}
        >
            {values.length === 0 ? (
                <span style={{color: '#888'}}>&lt;none&gt;</span>
            ) : (
                values.map((value, i) => (
                    <div key={i}>
                        {value || '<empty>'}
                        {isValueInvalid?.(value) && ' \u26A0'}
                    </div>
                ))
            )}
        </div>
    )
}
