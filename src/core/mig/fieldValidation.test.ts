import { describe, expect, it } from "vitest"
import type { ElementOverride, MessageElement } from "@/core/types/types"
import { createValueValidator } from "./fieldValidation"

function el(props: Partial<MessageElement> = {}): MessageElement {
  return {
    id: "x",
    name: "x",
    xmlTag: "x",
    isAttribute: false,
    definition: "",
    minOccurs: 1,
    maxOccurs: 1,
    typeId: "",
    type: "",
    baseType: "Text",
    minInclusive: null,
    maxInclusive: null,
    totalDigits: null,
    fractionDigits: null,
    length: null,
    minLength: null,
    maxLength: null,
    pattern: null,
    baseValue: null,
    codes: [],
    constraints: [],
    examples: [],
    elements: [],
    ...props,
  }
}

describe("createValueValidator", () => {
  it("accepts any value when no facets constrain it", () => {
    const v = createValueValidator(el(), undefined)
    expect(v("anything")).toBeNull()
  })

  it("flags values shorter or longer than the length bounds", () => {
    const v = createValueValidator(el({ minLength: 2, maxLength: 4 }), undefined)
    expect(v("a")).toMatch(/shorter than min length 2/i)
    expect(v("abcde")).toMatch(/longer than max length 4/i)
    expect(v("abc")).toBeNull()
  })

  it("treats an exact length as both bounds", () => {
    const v = createValueValidator(el({ length: 3 }), undefined)
    expect(v("ab")).toMatch(/shorter/i)
    expect(v("abcd")).toMatch(/longer/i)
    expect(v("abc")).toBeNull()
  })

  it("anchors and tests the pattern", () => {
    const v = createValueValidator(el({ pattern: "[A-Z]{3}" }), undefined)
    expect(v("ABC")).toBeNull()
    expect(v("abc")).toMatch(/does not match pattern/i)
    expect(v("ABCD")).toMatch(/does not match pattern/i) // anchored, no partial match
  })

  it("uses the override value, and a null override removes the constraint", () => {
    const e = el({ maxLength: 4 })
    expect(createValueValidator(e, { maxLength: 2 })("abc")).toMatch(/longer than max length 2/i)
    // null = remove the max-length constraint → long values are fine again.
    expect(createValueValidator(e, { maxLength: null })("abcdef")).toBeNull()
  })

  it("does not flag when the pattern is unparseable", () => {
    const v = createValueValidator(el({ pattern: "[" }), undefined)
    expect(v("anything")).toBeNull()
  })

  it("satisfies the ElementOverride type at the call site", () => {
    const override: ElementOverride = { minLength: 5 }
    expect(createValueValidator(el(), override)("abc")).toMatch(/shorter/i)
  })
})
