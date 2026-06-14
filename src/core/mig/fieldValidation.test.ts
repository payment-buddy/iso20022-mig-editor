import { describe, expect, it } from "vitest"
import type { ElementOverride, MessageElement } from "@/core/types/types"
import {
  createValueValidator,
  looseningWarning,
  patternWarning,
  rangeWarning,
} from "./fieldValidation"

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
    const v = createValueValidator(
      el({ minLength: 2, maxLength: 4 }),
      undefined
    )
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
    expect(createValueValidator(e, { maxLength: 2 })("abc")).toMatch(
      /longer than max length 2/i
    )
    // null = remove the max-length constraint → long values are fine again.
    expect(createValueValidator(e, { maxLength: null })("abcdef")).toBeNull()
  })

  it("does not flag when the pattern is unparseable", () => {
    const v = createValueValidator(el({ pattern: "[" }), undefined)
    expect(v("anything")).toBeNull()
  })

  it("flags values exceeding the total/fraction-digit facets", () => {
    const v = createValueValidator(
      el({ baseType: "Amount", totalDigits: 5, fractionDigits: 2 }),
      undefined
    )
    expect(v("123.45")).toBeNull() // 5 total, 2 fraction
    expect(v("1.234")).toMatch(/more than 2 fraction digits/i)
    expect(v("123456")).toMatch(/more than 5 total digits/i)
  })

  it("counts significant digits only (leading/trailing zeros don't count)", () => {
    const v = createValueValidator(
      el({ baseType: "Amount", totalDigits: 3, fractionDigits: 1 }),
      undefined
    )
    expect(v("1.50")).toBeNull() // trailing fraction zero ignored → 1 fraction digit
    expect(v("007.0")).toBeNull() // leading int zeros + trailing fraction zero ignored → 7
    expect(v("100")).toBeNull() // 3 total digits (trailing int zeros are significant)
  })

  it("skips the digit facets for non-decimal values", () => {
    const v = createValueValidator(
      el({ baseType: "Amount", totalDigits: 2 }),
      undefined
    )
    expect(v("ACTV")).toBeNull()
  })

  it("uses the effective (override) digit facets", () => {
    const e = el({ baseType: "Amount", fractionDigits: 4 })
    expect(createValueValidator(e, { fractionDigits: 2 })("1.234")).toMatch(
      /more than 2 fraction/i
    )
    expect(
      createValueValidator(e, { fractionDigits: null })("1.23456")
    ).toBeNull()
  })

  it("satisfies the ElementOverride type at the call site", () => {
    const override: ElementOverride = { minLength: 5 }
    expect(createValueValidator(el(), override)("abc")).toMatch(/shorter/i)
  })
})

describe("looseningWarning", () => {
  it("warns when a min facet drops below the baseline", () => {
    expect(looseningWarning("min occurs", 1, 0, "min")).toMatch(/below 1/i)
    expect(looseningWarning("min occurs", 1, 1, "min")).toBeNull()
    expect(looseningWarning("min occurs", 1, 2, "min")).toBeNull() // raising a min tightens
  })

  it("warns when a max facet rises above the baseline", () => {
    expect(looseningWarning("max length", 35, 50, "max")).toMatch(/above 35/i)
    expect(looseningWarning("max length", 35, 20, "max")).toBeNull() // lowering a max tightens
  })

  it("is silent when either side is unconstrained", () => {
    expect(looseningWarning("max length", null, 50, "max")).toBeNull()
    expect(looseningWarning("max length", 35, null, "max")).toBeNull()
  })
})

describe("rangeWarning", () => {
  it("warns when max is below min, otherwise silent", () => {
    expect(rangeWarning("Length", 5, 3)).toMatch(/max 3 is below min 5/i)
    expect(rangeWarning("Length", 3, 5)).toBeNull()
    expect(rangeWarning("Length", 5, 5)).toBeNull()
    expect(rangeWarning("Length", null, 3)).toBeNull()
  })
})

describe("patternWarning", () => {
  it("flags an unparseable regular expression", () => {
    expect(patternWarning("[A-Z")).toMatch(/invalid pattern/i)
    expect(patternWarning("[A-Z]+")).toBeNull()
    expect(patternWarning("")).toBeNull()
    expect(patternWarning(null)).toBeNull()
  })
})
