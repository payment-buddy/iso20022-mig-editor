import {describe, expect, it} from 'vitest'
import {isValidXsdPattern} from './regexUtils'

describe('isValidXsdPattern', () => {
  it('valid empty pattern', () => {
    expect(isValidXsdPattern('')).toBe(true)
  })

  it('valid simple pattern', () => {
    expect(isValidXsdPattern('a')).toBe(true)
  })

  it('valid alternation', () => {
    expect(isValidXsdPattern('a|b')).toBe(true)
  })

  it('valid digit class', () => {
    expect(isValidXsdPattern('\\d')).toBe(true)
  })

  it('valid character class', () => {
    expect(isValidXsdPattern('[a-z]')).toBe(true)
  })

  it('valid group', () => {
    expect(isValidXsdPattern('(ab)')).toBe(true)
  })

  it('invalid unbalanced bracket', () => {
    expect(isValidXsdPattern('[')).toBe(false)
  })

  it('invalid escape', () => {
    expect(isValidXsdPattern('\\[')).toBe(true) // actually valid
    expect(isValidXsdPattern('\\z')).toBe(false)
  })

  it('invalid quantifier without atom', () => {
    expect(isValidXsdPattern('*')).toBe(false)
  })

  it('rejects pattern starting with ^', () => {
    expect(isValidXsdPattern('^a')).toBe(false)
  })

  it('rejects pattern ending with $', () => {
    expect(isValidXsdPattern('a$')).toBe(false)
  })

  it('rejects pattern starting and ending with anchors', () => {
    expect(isValidXsdPattern('^a$')).toBe(false)
  })

  it('valid unicode letter property', () => {
    expect(isValidXsdPattern('\\p{L}')).toBe(true)
  })


  it('valid unicode category union', () => {
    expect(isValidXsdPattern('[\\p{L}\\p{N}]')).toBe(true)
  })

  it('invalid unicode property', () => {
    expect(isValidXsdPattern('\\p{Invalid}')).toBe(false)
  })
})