import { describe, expect, it } from "vitest"
import { parse } from "yaml"
import type {
  ElementOverrides,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import { buildPathOrder, serializeMig, serializeMigs } from "./serializeMig"

function mig(
  over: Partial<MessageImplementationGuide> = {}
): MessageImplementationGuide {
  return {
    name: "Guide",
    version: "1.0",
    messageIdentifier: "pacs.008.001.08",
    elementOverrides: {},
    ...over,
  }
}

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

/** Top-level keys (column-0 `key:` lines), in document order. */
const topKeys = (yaml: string) =>
  yaml
    .split("\n")
    .filter((l) => /^[A-Za-z]/.test(l))
    .map((l) => l.slice(0, l.indexOf(":")))

describe("serializeMig", () => {
  it("emits formatVersion first, then top-level keys in canonical order", () => {
    const out = serializeMig(
      mig({
        parentMIG: "Base:1",
        description: "A guide",
        elementAnnotationNames: ["Usage"],
        constraintAnnotationNames: ["Severity"],
      })
    )
    expect(topKeys(out)).toEqual([
      "formatVersion",
      "name",
      "version",
      "messageIdentifier",
      "parentMIG",
      "description",
      "elementAnnotationNames",
      "constraintAnnotationNames",
      "elementOverrides",
    ])
    expect(out.endsWith("\n")).toBe(true)
    expect(out.endsWith("\n\n")).toBe(false)
  })

  it("omits absent keys and empty lists, but preserves explicit null", () => {
    const out = serializeMig(
      mig({
        elementAnnotationNames: [],
        elementOverrides: {
          "/Doc/Amt": { maxLength: null, allowedValues: [], minOccurs: 0 },
        },
      })
    )
    expect(out).toContain("maxLength: null") // tri-state null kept
    expect(out).not.toContain("allowedValues") // empty list dropped
    expect(out).not.toContain("elementAnnotationNames") // empty list dropped
    expect(parse(out).elementOverrides["/Doc/Amt"]).toEqual({
      minOccurs: 0,
      maxLength: null,
    })
  })

  it("orders override fields and sorts/orders additional constraints", () => {
    const out = serializeMig(
      mig({
        constraintAnnotationNames: ["Severity"],
        elementOverrides: {
          "/Doc/Amt": {
            pattern: "[0-9]+",
            minOccurs: 0,
            additionalConstraints: {
              Zebra: { definition: "z" },
              Alpha: {
                definition: "a",
                expression: "x > 0",
                annotations: { Severity: "high" },
              },
            },
          },
        },
      })
    )
    // Override field order: minOccurs before pattern before additionalConstraints.
    expect(out.indexOf("minOccurs")).toBeLessThan(out.indexOf("pattern"))
    expect(out.indexOf("pattern")).toBeLessThan(
      out.indexOf("additionalConstraints")
    )
    // Constraints sorted by name key (Alpha before Zebra).
    expect(out.indexOf("Alpha")).toBeLessThan(out.indexOf("Zebra"))
    // Constraint field order under the name key: definition, expression, annotations.
    const alpha = out.slice(out.indexOf("Alpha"))
    expect(alpha.indexOf("definition")).toBeLessThan(
      alpha.indexOf("expression")
    )
    expect(alpha.indexOf("expression")).toBeLessThan(
      alpha.indexOf("annotations")
    )
  })

  it("serializes constraintOverrides (after additionalConstraints, name-sorted, null kept, empties pruned)", () => {
    const out = serializeMig(
      mig({
        elementOverrides: {
          "/Doc/Amt": {
            additionalConstraints: { Add: { definition: "a" } },
            constraintOverrides: {
              Zeta: { expression: "x > 0" },
              Alpha: { expression: null },
              Empty: {}, // pruned
            },
          },
        },
      })
    )
    expect(out.indexOf("additionalConstraints")).toBeLessThan(
      out.indexOf("constraintOverrides")
    )
    const block = out.slice(out.indexOf("constraintOverrides"))
    expect(block.indexOf("Alpha")).toBeLessThan(block.indexOf("Zeta")) // name-sorted
    expect(block).not.toContain("Empty") // entry with no fields dropped
    expect(block).toMatch(/Alpha:\s*\n\s*expression: null/) // tri-state null preserved
  })

  it("orders annotation values by declared name, then alphabetically", () => {
    const out = serializeMig(
      mig({
        elementAnnotationNames: ["Zeta", "Alpha"],
        elementOverrides: {
          "/Doc/Amt": { annotations: { Beta: "b", Alpha: "a", Zeta: "z" } },
        },
      })
    )
    // Declared order first (Zeta, Alpha), then undeclared alphabetical (Beta).
    expect(out.indexOf("Zeta:")).toBeLessThan(out.indexOf("Alpha:"))
    expect(out.indexOf("Alpha:")).toBeLessThan(out.indexOf("Beta:"))
  })

  it("schema-orders overrides by pathOrder, unknown paths last", () => {
    const root = el("Doc", [el("GrpHdr"), el("Amt")])
    const pathOrder = buildPathOrder(root)
    const overrides: ElementOverrides = {
      "/Doc/Stray": { minOccurs: 0 }, // not in the schema → last
      "/Doc/Amt": { minOccurs: 0 },
      "/Doc/GrpHdr": { minOccurs: 0 },
    }
    const out = serializeMig(mig({ elementOverrides: overrides }), pathOrder)
    expect(out.indexOf("/Doc/GrpHdr")).toBeLessThan(out.indexOf("/Doc/Amt"))
    expect(out.indexOf("/Doc/Amt")).toBeLessThan(out.indexOf("/Doc/Stray"))
  })

  it("falls back to alphabetical path order without a pathOrder", () => {
    const out = serializeMig(
      mig({
        elementOverrides: {
          "/Doc/Zzz": { minOccurs: 0 },
          "/Doc/Aaa": { minOccurs: 0 },
        },
      })
    )
    expect(out.indexOf("/Doc/Aaa")).toBeLessThan(out.indexOf("/Doc/Zzz"))
  })

  it("uses block literals for multi-line strings and never wraps", () => {
    const long = "word ".repeat(40).trim()
    const out = serializeMig(
      mig({
        elementOverrides: { "/Doc/Amt": { definition: `line one\nline two` } },
      })
    )
    expect(out).toMatch(/definition: \|/) // block literal marker
    // Single-line strings stay plain — not forced into block scalars.
    expect(out).toMatch(/^name: Guide$/m)
    const wrapped = serializeMig(mig({ description: long }))
    // No wrapping: the long value stays on one line.
    expect(wrapped.split("\n").some((l) => l.includes(long))).toBe(true)
  })

  it("round-trips through the YAML parser", () => {
    const source = mig({
      parentMIG: "Base:1",
      elementOverrides: { "/Doc/Amt": { maxLength: 35, definition: "x" } },
    })
    expect(parse(serializeMig(source))).toEqual({
      formatVersion: 1,
      name: "Guide",
      messageIdentifier: "pacs.008.001.08",
      parentMIG: "Base:1",
      version: "1.0",
      elementOverrides: { "/Doc/Amt": { definition: "x", maxLength: 35 } },
    })
  })
})

describe("buildPathOrder", () => {
  it("indexes elements in document order, parents before children", () => {
    const order = buildPathOrder(
      el("Doc", [el("GrpHdr", [el("CreDtTm")]), el("Amt")])
    )
    expect([...order.entries()]).toEqual([
      ["/Doc", 0],
      ["/Doc/GrpHdr", 1],
      ["/Doc/GrpHdr/CreDtTm", 2],
      ["/Doc/Amt", 3],
    ])
  })
})

describe("serializeMigs", () => {
  it("emits a YAML array of canonical MIGs", () => {
    const out = serializeMigs([mig({ name: "A" }), mig({ name: "B" })])
    const parsed = parse(out)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({ formatVersion: 1, name: "A" })
  })
})
