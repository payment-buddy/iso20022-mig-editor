import type {Constraint} from "./types.ts";

export function ConstraintNode({constraint, parentPath, selectedPath, onSelect}: {
    constraint: Constraint
    parentPath: string
    selectedPath: string
    onSelect: (constraint: Constraint, path: string) => void
}) {
    const contraintPath = parentPath + '/' + constraint.name;
    const isSelected = contraintPath === selectedPath
    const background = isSelected ? '#2b5ce6' : 'transparent'
    const color = isSelected ? '#fff' : undefined
    return (
        <div style={{marginLeft: '1em', cursor: 'pointer', background, color}}
             onClick={() => onSelect(constraint, contraintPath)}>
            <span style={{fontSize: '0.8em'}}>✔</span> {constraint.name}
        </div>
    )
}
