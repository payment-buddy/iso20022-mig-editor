import {useState} from "react"
import {WarningIcon} from "./WarningIcon"

export function EditableNumber({value, originalValue, onSave, warnWhen}: {
    value: number | null
    originalValue: number | null
    onSave: (value: string) => void
    warnWhen?: 'lower' | 'higher'
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
                min={0}
                onChange={e => setInputValue(e.target.value)}
                onBlur={save}
                onKeyDown={e => {
                    if (e.key === 'Enter') save()
                    if (e.key === 'Escape') setEditing(false)
                }}
            />
        )
    }

    const showWarning = value !== null && originalValue !== null &&
        (warnWhen === 'lower' ? value < originalValue : warnWhen === 'higher' ? value > originalValue : false)
    const isOverridden = value !== originalValue

    return (
        <span
            title={isOverridden ? `Original: ${originalValue ?? '<none>'}` : undefined}
            className={isOverridden ? 'is-overridden' : undefined}
            style={{cursor: 'pointer'}}
            onClick={startEdit}
        >
            {value ?? '<none>'}
            {showWarning && (<WarningIcon style={{marginLeft: '1em'}} />)}
        </span>
    )
}