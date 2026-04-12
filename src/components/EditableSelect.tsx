import {useState} from 'react'

export function EditableSelect({value, options, onSave, placeholder = '<none>', missingValue}: {
    value: string | null
    options: { id: string, name: string }[]
    onSave: (value: string | null) => void
    placeholder?: string
    missingValue?: string | null
}) {
    const [editing, setEditing] = useState(false)

    function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const val = e.target.value || null
        onSave(val)
        setEditing(false)
    }

    if (editing) {
        return (
            <div>
                <select
                    autoFocus
                    value={value ?? ''}
                    onChange={handleChange}
                    onBlur={() => setEditing(false)}
                    onKeyDown={e => {
                        if (e.key === 'Escape') setEditing(false)
                    }}
                    style={{
                        fontFamily: 'inherit',
                        fontSize: 'inherit'
                    }}
                >
                    <option value="">{placeholder}</option>
                    {options.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {missingValue && !options.some(o => o.id === missingValue) && (
                        <option value={missingValue}>{missingValue} (Missing)</option>
                    )}
                </select>
            </div>
        )
    }

    const selectedOption = options.find(o => o.id === value)
    let displayValue = placeholder
    let isMissing = false

    if (value) {
        if (selectedOption) {
            displayValue = selectedOption.name
        } else {
            displayValue = `${value} (Missing)`
            isMissing = true
        }
    }

    return (
        <span
            onClick={() => setEditing(true)}
            style={{
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                color: isMissing ? 'red' : 'inherit'
            }}
        >
            {displayValue}
        </span>
    )
}
