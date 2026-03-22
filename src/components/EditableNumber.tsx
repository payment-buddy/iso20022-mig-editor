import {useState} from "react";

export function EditableNumber({value, originalValue, onSave}: {
    value: number | null
    originalValue: number | null
    onSave: (value: string) => void
}) {
    const [editing, setEditing] = useState(false)
    const [inputValue, setInputValue] = useState('')

    function startEdit() {
        setInputValue(value != null ? String(value) : '')
        setEditing(true)
    }

    function save() {
        setEditing(false)
        onSave(inputValue)
    }

    if (editing) {
        return (
            <input
                autoFocus
                type="number"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onBlur={save}
                onKeyDown={e => {
                    if (e.key === 'Enter') save()
                    if (e.key === 'Escape') setEditing(false)
                }}
            />
        )
    }

    return (
        <>
            {value !== originalValue && (
                <span style={{textDecoration: 'line-through', marginRight: '1em'}}>
                {originalValue ?? '<none>'}
            </span>
            )}
            <span
                style={{cursor: 'pointer'}}
                onClick={startEdit}
            >
                {value ?? '<none>'}
            </span>
        </>
    )
}