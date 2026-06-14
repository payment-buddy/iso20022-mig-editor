import { describe, expect, it } from "vitest"
import type {
  MessageDefinition,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import type { MigDiff } from "./migDiff"
import { buildMigMarkdown, migMarkdown } from "./migMarkdown"

function diff(over: Partial<MigDiff> = {}): MigDiff {
  return {
    message: { name: "CreditTransfer", identifier: "pacs.008.001.08" },
    mig: { name: "EPC", version: "1.0", parents: [] },
    elements: [],
    loosenings: 0,
    ...over,
  }
}

describe("migMarkdown", () => {
  it("renders a header, message line, inherits and description", () => {
    const md = migMarkdown(
      diff({
        mig: {
          name: "EPC",
          version: "1.0",
          description: "Bank profile.",
          parents: ["Base:1"],
        },
      })
    )
    expect(md).toContain("# EPC 1.0")
    expect(md).toContain("**Message:** CreditTransfer (`pacs.008.001.08`)")
    expect(md).toContain("**Inherits:** Base:1")
    expect(md).toContain("Bank profile.")
    expect(md.endsWith("\n")).toBe(true)
  })

  it("renders a field-change table and a constraints list (escaping pipes)", () => {
    const md = migMarkdown(
      diff({
        elements: [
          {
            path: "/Doc/GrpHdr",
            name: "GrpHdr",
            excluded: false,
            orphan: false,
            changes: [
              {
                label: "Max length",
                kind: "tightened",
                baseline: "35",
                value: "20",
              },
            ],
            constraints: [
              {
                name: "R",
                definition: "must | hold",
                expression: "x > 0",
                annotations: [{ name: "Severity", value: "high" }],
                source: "added",
              },
            ],
          },
        ],
      })
    )
    expect(md).toContain("### GrpHdr")
    expect(md).toContain("`/Doc/GrpHdr`")
    expect(md).toContain("| Field | ISO | This MIG | Change |")
    expect(md).toContain("| Max length | 35 | 20 | tightened |")
    expect(md).toContain("- **R** — must \\| hold") // pipe escaped in the cell
    expect(md).toContain("  - Expression: `x > 0`")
    expect(md).toContain("  - Severity: high")
  })

  it("tags an overlaid standard constraint and a disabled one", () => {
    const md = migMarkdown(
      diff({
        elements: [
          {
            path: "/Doc/GrpHdr",
            name: "GrpHdr",
            excluded: false,
            orphan: false,
            changes: [],
            constraints: [
              {
                name: "Refined",
                definition: "d",
                expression: "x > 0",
                annotations: [],
                source: "standard",
              },
              {
                name: "Off",
                definition: "d",
                annotations: [],
                source: "standard",
                disabled: true,
              },
            ],
          },
        ],
      })
    )
    expect(md).toContain("- **Refined** _(overridden)_ — d")
    expect(md).toContain("- **Off** _(disabled)_ — d")
  })

  it("renders an excluded element without a table", () => {
    const md = migMarkdown(
      diff({
        elements: [
          {
            path: "/Doc/Amt",
            name: "Amt",
            excluded: true,
            orphan: false,
            changes: [],
            constraints: [],
          },
        ],
      })
    )
    expect(md).toContain("### Amt")
    expect(md).toContain(
      "**Excluded** — removed from the message (`maxOccurs: 0`)."
    )
    expect(md).not.toContain("| Field |")
  })

  it("shows warning banners for loosenings and an unloaded parent", () => {
    const md = migMarkdown(diff({ loosenings: 2, missingParent: "EPC:2023" }))
    expect(md).toContain(
      "> ⚠️ 2 field(s) are **looser** than the ISO standard."
    )
    expect(md).toContain("> ⚠️ Parent `EPC:2023` is not loaded")
  })

  it("states when a MIG makes no changes", () => {
    expect(migMarkdown(diff())).toContain(
      "_This MIG makes no changes to the ISO message._"
    )
  })
})

describe("buildMigMarkdown", () => {
  const el = (
    name: string,
    props: Partial<MessageElement> = {}
  ): MessageElement => ({
    id: name,
    name,
    xmlTag: name,
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
  })

  const message: MessageDefinition = {
    name: "CreditTransfer",
    identifier: "pacs.008.001.08",
    shortCode: "pacs.008",
    rootElement: el("Doc", {
      elements: [el("GrpHdr", { baseType: "Text", maxLength: 35 })],
    }),
  }

  it("names the file and renders the effective diff end-to-end", () => {
    const mig: MessageImplementationGuide = {
      name: "EPC",
      version: "1.0",
      messageIdentifier: "pacs.008.001.08",
      elementOverrides: { "/Doc/GrpHdr": { maxLength: 20 } },
    }
    const file = buildMigMarkdown(mig, [mig], message)
    expect(file.filename).toBe("EPC-1.0.md")
    expect(file.content).toContain("# EPC 1.0")
    expect(file.content).toContain("| Max length | 35 | 20 | tightened |")
  })
})
