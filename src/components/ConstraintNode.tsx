import type {Constraint} from "../types/types.ts";

export function ConstraintNode({constraint, parentPath, selectedPath, onSelect}: {
    constraint: Constraint
    parentPath: string
    selectedPath: string
    onSelect: (constraint: Constraint, path: string) => void
}) {
    const constraintPath = parentPath + '/' + constraint.name;
    const isSelected = constraintPath === selectedPath
    return (
        <div className={'tree-node' + (isSelected ? ' is-selected' : '')}
             style={{marginLeft: '1em'}}
             onClick={() => onSelect(constraint, constraintPath)}>
            <span style={{fontSize: '0.8em'}}>✔</span> {constraint.name}
        </div>
    )
}
