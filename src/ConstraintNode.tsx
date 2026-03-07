import type {Constraint} from "./types.ts";

export function ConstraintNode({constraint, selectedConstraint, onSelect}: {
    constraint: Constraint
    selectedConstraint: Constraint | null
    onSelect: (constraint: Constraint) => void
}) {
    const background = constraint.name === selectedConstraint?.name ? '#2b5ce6' : 'transparent'
    return (
        <div style={{marginLeft: '1em', cursor: 'pointer', background: background}}
             onClick={() => onSelect(constraint)}>
            ✔ {constraint.name}
        </div>
    )
}