import { describe, expect, it } from "vitest"
import type { MessageElement } from "@/core/types/types"
import { parseExpression } from "./parser"
import { collectPaths, pathText, validateExpressionPaths } from "./paths"

function el(
  xmlTag: string,
  elements: MessageElement[] = [],
  isAttribute = false
): MessageElement {
  return {
    id: xmlTag,
    name: xmlTag,
    xmlTag,
    isAttribute,
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

const attr = (xmlTag: string) => el(xmlTag, [], true)

// Owner element of the constraint: Id, and SchmeNm/Prtry, and Amt/@Ccy.
const owner = el("Othr", [
  el("Id"),
  el("SchmeNm", [el("Prtry"), el("Cd")]),
  el("Amt", [attr("Ccy")]),
])

/** Parse `src` and validate its paths against `owner`, returning the messages. */
function check(src: string, against: MessageElement = owner): string[] {
  const r = parseExpression(src)
  if (!r.ok) throw new Error(`expected ${JSON.stringify(src)} to parse`)
  return validateExpressionPaths(r.ast, against).map((e) => e.message)
}

describe("collectPaths / pathText", () => {
  it("collects every path in source order", () => {
    const r = parseExpression(
      "not(SchmeNm/Prtry = 'LGID' or matches(Id, '[0-9]+'))"
    )
    if (!r.ok) throw new Error("parse failed")
    expect(collectPaths(r.ast).map(pathText)).toEqual(["SchmeNm/Prtry", "Id"])
  })

  it("renders an attribute step with @", () => {
    const r = parseExpression("Amt/@Ccy = 'EUR'")
    if (!r.ok) throw new Error("parse failed")
    expect(pathText(collectPaths(r.ast)[0])).toBe("Amt/@Ccy")
  })
})

describe("validateExpressionPaths", () => {
  it("accepts paths that resolve to nested elements", () => {
    expect(check("Id = 'X'")).toEqual([])
    expect(check("SchmeNm/Prtry = 'LGID'")).toEqual([])
    expect(check("Amt/@Ccy = 'EUR'")).toEqual([])
    expect(
      check("not(SchmeNm/Prtry = 'LGID' or matches(Id, '[0-9]+'))")
    ).toEqual([])
  })

  it("flags an unknown first step", () => {
    expect(check("Nope = 1")).toEqual(['Unknown element "Nope" in path "Nope"'])
  })

  it("flags an unknown nested step, naming the path", () => {
    expect(check("SchmeNm/Xyz = 1")).toEqual([
      'Unknown element "Xyz" in path "SchmeNm/Xyz"',
    ])
  })

  it("hints when an element is referenced as an attribute", () => {
    expect(check("SchmeNm/@Prtry = 1")[0]).toMatch(
      /is an element, not an attribute/
    )
  })

  it("hints when an attribute is referenced without @", () => {
    expect(check("Amt/Ccy = 1")[0]).toMatch(/reference it as "@Ccy"/)
  })

  it("flags an unknown attribute", () => {
    expect(check("Amt/@Nope = 1")).toEqual([
      'Unknown attribute "@Nope" in path "Amt/@Nope"',
    ])
  })

  it("rejects steps after an attribute (leaf)", () => {
    expect(check("Amt/@Ccy/Sub = 1")[0]).toMatch(/cannot have child steps/)
  })

  it("reports one error per unresolved path", () => {
    expect(check("Bad1 = Bad2")).toHaveLength(2)
  })
})
