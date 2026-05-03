import type {Constraint} from "../types/types.ts"
import {useMessageTreeContext} from "../contexts/MessageTreeContext.tsx"

export function ConstraintNode({constraint, parentPath, isAdditional, parentExcluded}: {
    constraint: Constraint
    parentPath: string
    isAdditional?: boolean
    parentExcluded?: boolean
}) {
    const {selectedPath, filterActive, visiblePaths, onSelectConstraint} = useMessageTreeContext()
    const constraintPath = parentPath + '/' + constraint.name
    const isSelected = constraintPath === selectedPath
    if (filterActive && !visiblePaths.has(constraintPath)) return null
    return (
        <div className={'tree-node' + (isSelected ? ' is-selected' : '')}
             onClick={() => onSelectConstraint(constraint, constraintPath)}>
            <span style={{fontSize: '0.8em'}}>✔</span>&nbsp;
            <span
                className={(isAdditional ? ' has-override' : '') + (parentExcluded ? ' is-excluded' : '')}>{constraint.name}</span>
        </div>
    )
}
