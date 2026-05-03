import type {ElementOverride, ElementOverrides, MessageImplementationGuide} from "../types/types.ts"

export function getParentOptions(
    mig: MessageImplementationGuide,
    migs: MessageImplementationGuide[]
): { value: string, name: string }[] {
    return migs
        .filter(m => {
            if (m.messageIdentifier !== mig.messageIdentifier || m.id === mig.id) return false
            // Check for cycles
            let current = migs.find(p => p.id === m.id)
            const visited = new Set<string>()
            while (current) {
                if (current.id === mig.id) return false
                if (visited.has(current.id)) return false
                visited.add(current.id)
                current = current.parentMIG ? migs.find(p => p.id === current!.parentMIG) : undefined
            }
            return true
        })
        .map(m => ({ value: m.id, name: m.name }))
}

export function getCombinedOverrides(
    mig: MessageImplementationGuide,
    migs: MessageImplementationGuide[]
): ElementOverrides {
    const chain: MessageImplementationGuide[] = []
    let current: MessageImplementationGuide | undefined = mig
    const seen = new Set<string>()

    while (current && !seen.has(current.id)) {
        chain.unshift(current) // parent first
        seen.add(current.id)
        const parentId: string | null = current.parentMIG
        current = parentId ? migs.find(m => m.id === parentId) : undefined
    }

    const combined: ElementOverrides = {}

    for (const m of chain) {
        for (const [path, override] of Object.entries(m.elementOverrides)) {
            combined[path] = mergeOverrides(combined[path], override)
        }
    }

    return combined
}

function mergeOverrides(parent: ElementOverride | undefined, current: ElementOverride): ElementOverride {
    if (!parent) return current

    return {
        definition: current.definition ?? parent.definition,
        minOccurs: current.minOccurs ?? parent.minOccurs,
        maxOccurs: current.maxOccurs ?? parent.maxOccurs,
        minInclusive: current.minInclusive ?? parent.minInclusive,
        maxInclusive: current.maxInclusive ?? parent.maxInclusive,
        totalDigits: current.totalDigits ?? parent.totalDigits,
        fractionDigits: current.fractionDigits ?? parent.fractionDigits,
        minLength: current.minLength ?? parent.minLength,
        maxLength: current.maxLength ?? parent.maxLength,
        pattern: current.pattern ?? parent.pattern,
        allowedValues: current.allowedValues ?? parent.allowedValues,
        examples: current.examples ?? parent.examples,
        additionalConstraints: mergeConstraints(parent.additionalConstraints, current.additionalConstraints)
    }
}

function mergeConstraints(parent: any[] | null | undefined, current: any[] | null | undefined): any[] | null {
    if (!parent && !current) return null
    if (!parent) return current ?? null
    if (!current) return parent ?? null
    
    // Combine both, but keep unique by name? 
    // Usually implementation guides add more constraints.
    // If name matches, current wins.
    const result = [...parent]
    for (const c of current) {
        const index = result.findIndex(p => p.name === c.name)
        if (index !== -1) {
            result[index] = c
        } else {
            result.push(c)
        }
    }
    return result
}
