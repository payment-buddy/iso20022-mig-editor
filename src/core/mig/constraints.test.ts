import { describe, expect, it } from "vitest"
import type {
  Constraint,
  ElementOverride,
  MessageElement,
} from "@/core/types/types"
import { resolveConstraints } from "./constraints"

const constraint = (
  name: string,
  extra: Partial<Constraint> = {}
): Constraint => ({
  name,
  definition: `${name} def`,
  ...extra,
})

function el(constraints: Constraint[]): MessageElement {
  return {
    id: "E",
    name: "E",
    xmlTag: "E",
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
    constraints,
    examples: [],
    elements: [],
  }
}

describe("resolveConstraints", () => {
  it("returns standard then additional constraints, tagged by source", () => {
    const override: ElementOverride = {
      additionalConstraints: [constraint("Extra")],
    }
    const out = resolveConstraints(el([constraint("Std")]), override)
    expect(out.map((r) => [r.constraint.name, r.source])).toEqual([
      ["Std", "standard"],
      ["Extra", "additional"],
    ])
  })

  it("overlays an expression onto a standard constraint", () => {
    const override: ElementOverride = {
      constraintOverrides: { Std: { expression: "Amt > 0" } },
    }
    const [r] = resolveConstraints(el([constraint("Std")]), override)
    expect(r.constraint.expression).toBe("Amt > 0")
  })

  it("overlays the definition (null blanks it)", () => {
    const [set] = resolveConstraints(el([constraint("Std")]), {
      constraintOverrides: { Std: { definition: "Refined" } },
    })
    expect(set.constraint.definition).toBe("Refined")
    const [blank] = resolveConstraints(el([constraint("Std")]), {
      constraintOverrides: { Std: { definition: null } },
    })
    expect(blank.constraint.definition).toBe("")
  })

  it("clears the inherited expression when the overlay sets null", () => {
    const override: ElementOverride = {
      constraintOverrides: { Std: { expression: null } },
    }
    const [r] = resolveConstraints(
      el([constraint("Std", { expression: "old" })]),
      override
    )
    expect(r.constraint.expression).toBeUndefined()
  })

  it("leaves a constraint untouched when no overlay targets its name", () => {
    const out = resolveConstraints(
      el([constraint("Std", { expression: "keep" })]),
      {
        constraintOverrides: { Other: { expression: "x" } },
      }
    )
    expect(out[0].constraint.expression).toBe("keep")
  })

  it("returns the base constraint object unmodified (no overlay)", () => {
    const base = constraint("Std", { expression: "e" })
    const [r] = resolveConstraints(el([base]), undefined)
    expect(r.constraint).toBe(base)
  })

  it("reports the disabled flag from the overlay", () => {
    const out = resolveConstraints(el([constraint("On"), constraint("Off")]), {
      constraintOverrides: { Off: { disabled: true } },
    })
    expect(out.map((r) => [r.constraint.name, r.disabled])).toEqual([
      ["On", false],
      ["Off", true],
    ])
  })
})
