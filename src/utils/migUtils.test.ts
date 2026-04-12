import {describe, it, expect} from 'vitest'
import {getCombinedOverrides} from './migUtils.ts'
import type {MessageImplementationGuide, ElementOverride} from '../types/types.ts'

describe('migUtils', () => {
    const mig1: MessageImplementationGuide = {
        id: 'mig1',
        name: 'MIG 1',
        messageIdentifier: 'pain.001.001.03',
        parentMIG: null,
        version: '1.0',
        description: '',
        elementOverrides: {
            'root/elem1': {
                definition: 'MIG1 definition',
                minOccurs: 1,
                maxOccurs: 1,
                minInclusive: null,
                maxInclusive: null,
                totalDigits: null,
                fractionDigits: null,
                minLength: null,
                maxLength: null,
                pattern: null,
                allowedValues: null,
                examples: ['ex1'],
                additionalConstraints: [{name: 'C1', definition: 'D1', expression: 'E1'}]
            } as ElementOverride
        }
    }

    const mig2: MessageImplementationGuide = {
        id: 'mig2',
        name: 'MIG 2',
        messageIdentifier: 'pain.001.001.03',
        parentMIG: 'mig1',
        version: '1.0',
        description: '',
        elementOverrides: {
            'root/elem1': {
                definition: 'MIG2 definition',
                minOccurs: null,
                maxOccurs: null,
                minInclusive: null,
                maxInclusive: null,
                totalDigits: null,
                fractionDigits: null,
                minLength: null,
                maxLength: null,
                pattern: null,
                allowedValues: ['V1'],
                examples: null,
                additionalConstraints: [{name: 'C2', definition: 'D2', expression: 'E2'}]
            } as ElementOverride,
            'root/elem2': {
                definition: 'MIG2 definition 2',
                minOccurs: 0,
                maxOccurs: 0,
                minInclusive: null,
                maxInclusive: null,
                totalDigits: null,
                fractionDigits: null,
                minLength: null,
                maxLength: null,
                pattern: null,
                allowedValues: null,
                examples: null,
                additionalConstraints: null
            } as ElementOverride
        }
    }

    const migs = [mig1, mig2]

    it('returns own overrides when no parent', () => {
        const combined = getCombinedOverrides(mig1, migs)
        expect(combined['root/elem1'].definition).toBe('MIG1 definition')
        expect(combined['root/elem1'].examples).toEqual(['ex1'])
    })

    it('merges overrides from parent', () => {
        const combined = getCombinedOverrides(mig2, migs)
        
        // Inherited and overridden
        expect(combined['root/elem1'].definition).toBe('MIG2 definition')
        
        // Inherited from mig1
        expect(combined['root/elem1'].minOccurs).toBe(1)
        expect(combined['root/elem1'].examples).toEqual(['ex1'])
        
        // Added in mig2
        expect(combined['root/elem1'].allowedValues).toEqual(['V1'])
        expect(combined['root/elem2'].maxOccurs).toBe(0)
    })

    it('merges constraints', () => {
        const combined = getCombinedOverrides(mig2, migs)
        const constraints = combined['root/elem1'].additionalConstraints
        expect(constraints).toHaveLength(2)
        expect(constraints?.map(c => c.name)).toContain('C1')
        expect(constraints?.map(c => c.name)).toContain('C2')
    })
    
    it('handles circular references gracefully', () => {
        const migA: MessageImplementationGuide = { ...mig1, id: 'A', parentMIG: 'B' }
        const migB: MessageImplementationGuide = { ...mig1, id: 'B', parentMIG: 'A' }
        const combined = getCombinedOverrides(migA, [migA, migB])
        expect(combined).toBeDefined()
    })
})
