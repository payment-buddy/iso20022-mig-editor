import { describe, expect, it } from "vitest"
import type { MessageElement } from "@/core/types/types"
import { elementAtPath, rootPath } from "./elementPath"

function el(xmlTag: string, elements: MessageElement[] = []): MessageElement {
  return {
    id: xmlTag,
    name: xmlTag,
    xmlTag,
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
    elements,
  }
}

const root = el("Doc", [el("GrpHdr", [el("MsgId")]), el("Amt")])

describe("rootPath", () => {
  it("is the root xmlTag with a leading slash", () => {
    expect(rootPath(root)).toBe("/Doc")
  })
})

describe("elementAtPath", () => {
  it("resolves the root and nested absolute paths", () => {
    expect(elementAtPath(root, "/Doc")?.xmlTag).toBe("Doc")
    expect(elementAtPath(root, "/Doc/Amt")?.xmlTag).toBe("Amt")
    expect(elementAtPath(root, "/Doc/GrpHdr/MsgId")?.xmlTag).toBe("MsgId")
  })

  it("also accepts a root-relative path (leading slash optional)", () => {
    expect(elementAtPath(root, "Doc/Amt")?.xmlTag).toBe("Amt")
  })

  it("returns null for an absent path or a wrong root", () => {
    expect(elementAtPath(root, "/Doc/Missing")).toBeNull()
    expect(elementAtPath(root, "/Doc/GrpHdr/Nope")).toBeNull()
    expect(elementAtPath(root, "/Other/Amt")).toBeNull()
  })
})
