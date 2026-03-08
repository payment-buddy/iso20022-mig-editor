import type {Constraint} from "./types.ts";

export function ConstraintNode({constraint, selectedConstraint, onSelect}: {
    constraint: Constraint
    selectedConstraint: Constraint | null
    onSelect: (constraint: Constraint) => void
}) {
    const background = constraint.name === selectedConstraint?.name ? '#2b5ce6' : 'transparent'
    const color =  constraint.name === selectedConstraint?.name ? '#fff' : undefined
    return (
        <div style={{marginLeft: '1em', cursor: 'pointer', background, color}}
             onClick={() => onSelect(constraint)}>
            ✔ {constraint.name}
        </div>
    )
}