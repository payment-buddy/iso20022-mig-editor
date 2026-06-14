import { describe, expect, it } from "vitest"
import type { MessageElement } from "@/core/types/types"
import { isExternalCodeSet } from "./codeSet"

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
    baseType: null,
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

describe("isExternalCodeSet", () => {
  it("is true for a CodeSet named with the External prefix", () => {
    expect(
      isExternalCodeSet(
        el({ baseType: "CodeSet", type: "ExternalPurpose1Code" })
      )
    ).toBe(true)
  })

  it("is false for an ordinary (enumerated) CodeSet", () => {
    expect(
      isExternalCodeSet(el({ baseType: "CodeSet", type: "AddressType2Code" }))
    ).toBe(false)
  })

  it("is false for non-CodeSet types even when named External-ish", () => {
    expect(
      isExternalCodeSet(el({ baseType: "Text", type: "ExternalNote" }))
    ).toBe(false)
  })
})
