import {describe, expect, it} from 'vitest'
import {splitCamelCase} from './stringUtils.ts'

describe('splitCamelCase', () => {
    it('splits camelCase words', () => {
        expect(splitCamelCase('camelCase')).toBe('camel Case')
    })

    it('splits PascalCase words', () => {
        expect(splitCamelCase('PascalCase')).toBe('Pascal Case')
    })

    it('handles acronyms', () => {
        expect(splitCamelCase('XMLTag')).toBe('XML Tag')
    })

    it('handles mixed acronyms and camelCase', () => {
        expect(splitCamelCase('myXMLProperty')).toBe('my XML Property')
    })

    it('returns single word as-is', () => {
        expect(splitCamelCase('name')).toBe('name')
    })

    it('handles empty string', () => {
        expect(splitCamelCase('')).toBe('')
    })
})
