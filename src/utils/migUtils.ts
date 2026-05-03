import type {Constraint, ElementOverride, ElementOverrides, MessageImplementationGuide} from "../types/types.ts"
import {CONSTRAINT_PROPERTY_ORDER, ELEMENT_OVERRIDE_PROPERTY_ORDER, MIG_PROPERTY_ORDER} from "../types/types.ts"

export function getMigKey(mig: MessageImplementationGuide): string {
    return `${mig.name}:${mig.version}`
}

export function findMigByKey(migs: MessageImplementationGuide[], key: string): MessageImplementationGuide | undefined {
    return migs.find(m => getMigKey(m) === key)
}

export function getParentOptions(
    mig: MessageImplementationGuide,
    migs: MessageImplementationGuide[]
): { value: string, name: string }[] {
    const migKey = getMigKey(mig)
    return migs
        .filter(m => {
            if (m.messageIdentifier !== mig.messageIdentifier) return false
            const mKey = getMigKey(m)
            if (mKey === migKey) return false
            // Check for cycles
            let current = migs.find(p => getMigKey(p) === mKey)
            const visited = new Set<string>()
            while (current) {
                const currentKey = getMigKey(current)
                if (currentKey === migKey) return false
                if (visited.has(currentKey)) return false
                visited.add(currentKey)
                current = current.parentMIG ? findMigByKey(migs, current.parentMIG) : undefined
            }
            return true
        })
        .map(m => ({ value: getMigKey(m), name: m.name }))
}

export function getCombinedOverrides(
    mig: MessageImplementationGuide,
    migs: MessageImplementationGuide[]
): ElementOverrides {
    const chain: MessageImplementationGuide[] = []
    let current: MessageImplementationGuide | undefined = mig
    const seen = new Set<string>()

    while (current && !seen.has(getMigKey(current))) {
        chain.unshift(current) // parent first
        seen.add(getMigKey(current))
        const parentKey: string | null = current.parentMIG
        current = parentKey ? findMigByKey(migs, parentKey) : undefined
    }

    const combined: ElementOverrides = {}

    for (const m of chain) {
        for (const [path, override] of Object.entries(m.elementOverrides)) {
            combined[path] = mergeOverrides(combined[path], override)
        }
    }

    return combined
}

function mergeCustomProperties(
    parent: Record<string, string> | null | undefined,
    current: Record<string, string> | null | undefined
): Record<string, string> | null {
    const merged = { ...(parent ?? {}), ...(current ?? {}) }
    return Object.keys(merged).length > 0 ? merged : null
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
        additionalConstraints: mergeConstraints(parent.additionalConstraints, current.additionalConstraints),
        customProperties: mergeCustomProperties(parent.customProperties, current.customProperties)
    }
}

function mergeConstraints(parent: Constraint[] | null | undefined, current: Constraint[] | null | undefined): Constraint[] | null {
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

function orderCustomProperties(
    customProperties: Record<string, string> | null | undefined,
    propertyNamesStr: string | undefined
): Record<string, string> | null {
    if (!customProperties || Object.keys(customProperties).length === 0) return null

    const orderedNames = (propertyNamesStr ?? '')
        .split(',')
        .map(n => n.trim())
        .filter(n => n.length > 0)

    const result: Record<string, string> = {}
    const remaining = {...customProperties}

    for (const name of orderedNames) {
        if (name in remaining) {
            result[name] = remaining[name]
            delete remaining[name]
        }
    }

    const sortedRemaining = Object.keys(remaining).sort()
    for (const name of sortedRemaining) {
        result[name] = remaining[name]
    }

    return Object.keys(result).length > 0 ? result : null
}

function normalizeConstraint(
    constraint: Constraint,
    customConstraintPropertyNames: string | undefined
): Constraint {
    const ordered: Record<string, unknown> = {}

    for (const prop of CONSTRAINT_PROPERTY_ORDER) {
        if (prop === 'customProperties') {
            ordered[prop] = orderCustomProperties(constraint.customProperties, customConstraintPropertyNames)
        } else if (prop in constraint) {
            ordered[prop] = constraint[prop as keyof Constraint]
        }
    }

    return ordered as unknown as Constraint
}

function normalizeElementOverride(
    override: ElementOverride,
    customElementPropertyNames: string | undefined,
    customConstraintPropertyNames: string | undefined
): ElementOverride {
    const ordered: Record<string, unknown> = {}

    for (const prop of ELEMENT_OVERRIDE_PROPERTY_ORDER) {
        if (prop === 'customProperties') {
            ordered[prop] = orderCustomProperties(override.customProperties, customElementPropertyNames)
        } else if (prop === 'additionalConstraints' && override.additionalConstraints) {
            const sorted = [...override.additionalConstraints]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(c => normalizeConstraint(c, customConstraintPropertyNames))
            ordered[prop] = sorted.length > 0 ? sorted : null
        } else if (prop in override) {
            ordered[prop] = override[prop as keyof ElementOverride]
        }
    }

    return ordered as unknown as ElementOverride
}

export function normalizeMigForExport(mig: MessageImplementationGuide): MessageImplementationGuide {
    const ordered: Record<string, unknown> = {}

    for (const prop of MIG_PROPERTY_ORDER) {
        if (prop === 'elementOverrides') {
            const sortedPaths = Object.keys(mig.elementOverrides).sort()
            const normalizedOverrides: ElementOverrides = {}
            for (const path of sortedPaths) {
                normalizedOverrides[path] = normalizeElementOverride(
                    mig.elementOverrides[path],
                    mig.customElementPropertyNames,
                    mig.customConstraintPropertyNames
                )
            }
            ordered[prop] = normalizedOverrides
        } else if (prop in mig) {
            ordered[prop] = mig[prop as keyof MessageImplementationGuide]
        }
    }

    return ordered as unknown as MessageImplementationGuide
}

export function prepareForDownload(obj: unknown): unknown {
    if (Array.isArray(obj)) {
        return obj.map(item => {
            if (isMessageImplementationGuide(item)) {
                return normalizeMigForExport(item)
            }
            return item
        })
    }
    if (isMessageImplementationGuide(obj)) {
        return normalizeMigForExport(obj)
    }
    return obj
}

function isMessageImplementationGuide(obj: unknown): obj is MessageImplementationGuide {
    return obj !== null &&
        typeof obj === 'object' &&
        'elementOverrides' in obj &&
        'id' in obj &&
        'name' in obj
}
