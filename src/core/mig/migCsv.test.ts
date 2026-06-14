import { describe, expect, it } from "vitest"
import type {
  Code,
  MessageDefinition,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import { buildMigCsv, buildMigCsvRows } from "./migCsv"

function el(
  xmlTag: string,
  props: Partial<MessageElement> = {},
  elements: MessageElement[] = [],
): MessageElement {
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
    ...props,
  }
}

const codes = (...names: string[]): Code[] => names.map((codeName) => ({ codeName, definition: "" }))

// Doc › GrpHdr › { MsgId(Text 1..35), Itm(complex, 0..*) }, Amt(Decimal 18.4),
// Ccy(Text codes), Dt(DateTime)
const MESSAGE: MessageDefinition = {
  name: "FIToFICstmrCdtTrf",
  identifier: "pacs.008.001.08",
  shortCode: "pacs.008",
  rootElement: el("Doc", {}, [
    el("GrpHdr", {}, [
      el("MsgId", {
        baseType: "Text",
        type: "Max35Text",
        minLength: 1,
        maxLength: 35,
        constraints: [{ name: "Format", definition: "No leading spaces." }],
      }),
      el("Itm", { maxOccurs: null }, [el("Val", { baseType: "Text", type: "Text", maxLength: 4 })]),
    ]),
    el("Amt", { baseType: "Decimal", type: "Amount", totalDigits: 18, fractionDigits: 4, minOccurs: 0 }),
    el("Ccy", { baseType: "Text", type: "CurrencyCode", codes: codes("EUR", "USD", "NOK") }),
    el("Dt", { baseType: "ISODateTime", type: "ISODateTime", minOccurs: 0 }),
  ]),
}

function mig(
  name: string,
  overrides: MessageImplementationGuide["elementOverrides"],
  extra: Partial<MessageImplementationGuide> = {},
): MessageImplementationGuide {
  return { name, version: "1.0", messageIdentifier: "pacs.008.001.08", elementOverrides: overrides, ...extra }
}

/** Column index by header. */
function col(columns: string[], name: string): number {
  return columns.indexOf(name)
}

describe("buildMigCsvRows — element rows", () => {
  it("emits one row per element in document order, with ISO structure and type", () => {
    const { columns, rows } = buildMigCsvRows(mig("M", {}), [], MESSAGE)
    expect(columns.slice(0, 8)).toEqual([
      "Level",
      "Choice",
      "Name",
      "XML tag",
      "Path",
      "Multiplicity",
      "Type",
      "Annotations",
    ])

    // Element rows only (Level, Name, XML tag, Multiplicity, Type).
    const elementRows = rows.filter((r) => r[col(columns, "Name")] !== "")
    expect(elementRows.map((r) => [r[0], r[2], r[3], r[5], r[6]])).toEqual([
      ["0", "Doc", "Doc", "[1..1]", ""],
      ["1", "GrpHdr", "GrpHdr", "[1..1]", ""],
      ["2", "MsgId", "MsgId", "[1..1]", "Text[1..35]"],
      ["2", "Itm", "Itm", "[1..*]", ""],
      ["3", "Val", "Val", "[1..1]", "Text[..4]"],
      ["1", "Amt", "Amt", "[0..1]", "Decimal[18.4]"],
      ["1", "Ccy", "Ccy", "[1..1]", "Text[EUR|USD|NOK]"],
      ["1", "Dt", "Dt", "[0..1]", "DateTime"],
    ])
  })

  it("renders Path as an indented multiline name tree, root skipped", () => {
    const { columns, rows } = buildMigCsvRows(mig("M", {}), [], MESSAGE)
    const pathOf = (name: string) =>
      rows.find((r) => r[col(columns, "Name")] === name)![col(columns, "Path")]
    expect(pathOf("Doc")).toBe("") // root skipped
    expect(pathOf("GrpHdr")).toBe("+GrpHdr")
    expect(pathOf("Val")).toBe("+GrpHdr\n++Itm\n+++Val")
  })

  it("lists ISO constraints as rule rows sourced to ISO", () => {
    const { columns, rows } = buildMigCsvRows(mig("M", {}), [], MESSAGE)
    const r = rows.find((x) => x[col(columns, "Rule")] === "Format")!
    expect(r[col(columns, "Source")]).toBe("ISO")
    expect(r[col(columns, "Definition")]).toBe("No leading spaces.")
    // Common columns are blank on a rule row.
    expect(r.slice(0, 8)).toEqual(["", "", "", "", "", "", "", ""])
  })

  it("applies a MIG overlay onto an ISO constraint (effective expression, MIG source)", () => {
    const m = mig("M", {
      "Doc/GrpHdr/MsgId": { constraintOverrides: { Format: { expression: "matches(., '[A-Z]+')" } } },
    })
    const { columns, rows } = buildMigCsvRows(m, [], MESSAGE)
    const r = rows.find((x) => x[col(columns, "Rule")] === "Format")!
    expect(r[col(columns, "Source")]).toBe("M") // overlaid → sourced to the MIG, not ISO
    expect(r[col(columns, "Expression")]).toBe("matches(., '[A-Z]+')")
  })

  it("marks a disabled ISO constraint in the Rule column", () => {
    const m = mig("M", { "Doc/GrpHdr/MsgId": { constraintOverrides: { Format: { disabled: true } } } })
    const { columns, rows } = buildMigCsvRows(m, [], MESSAGE)
    const r = rows.find((x) => x[col(columns, "Rule")] === "Format (disabled)")!
    expect(r[col(columns, "Source")]).toBe("M")
  })

  it("renders element annotations as a single multiline cell before Source", () => {
    const { columns, rows } = buildMigCsvRows(
      mig("M", { "Doc/Amt": { annotations: { Purpose: "Payment", Note: "x" } } }),
      [],
      MESSAGE,
    )
    const amt = rows.find((r) => r[col(columns, "Name")] === "Amt")!
    expect(amt[col(columns, "Annotations")]).toBe("Purpose: Payment\nNote: x")
  })
})

describe("buildMigCsvRows — overrides", () => {
  it("emits a Multiplicity rule with the overridden value", () => {
    const { columns, rows } = buildMigCsvRows(
      mig("M", { "Doc/Amt": { minOccurs: 1 } }),
      [],
      MESSAGE,
    )
    const r = rows.find((x) => x[col(columns, "Rule")] === "Multiplicity")!
    expect(r[col(columns, "Source")]).toBe("M")
    expect(r[col(columns, "Definition")]).toBe("[1..1]")
  })

  it("emits a Type rule with the overridden type in the Type format", () => {
    const { columns, rows } = buildMigCsvRows(
      mig("M", { "Doc/GrpHdr/MsgId": { maxLength: 20 } }),
      [],
      MESSAGE,
    )
    const r = rows.find((x) => x[col(columns, "Rule")] === "Type")!
    expect(r[col(columns, "Source")]).toBe("M")
    expect(r[col(columns, "Definition")]).toBe("Text[1..20]")
  })

  it("emits added constraints sourced to this MIG", () => {
    const { columns, rows } = buildMigCsvRows(
      mig("M", {
        "Doc/Amt": { additionalConstraints: [{ name: "Positive", definition: "Must be > 0" }] },
      }),
      [],
      MESSAGE,
    )
    const r = rows.find((x) => x[col(columns, "Rule")] === "Positive")!
    expect(r[col(columns, "Source")]).toBe("M")
    expect(r[col(columns, "Definition")]).toBe("Must be > 0")
  })

  it("fills the Expression column for a constraint", () => {
    const { columns, rows } = buildMigCsvRows(
      mig("M", {
        "Doc/Amt": { additionalConstraints: [{ name: "R", definition: "d", expression: "a > 0" }] },
      }),
      [],
      MESSAGE,
    )
    const r = rows.find((x) => x[col(columns, "Rule")] === "R")!
    expect(r[col(columns, "Definition")]).toBe("d")
    expect(r[col(columns, "Expression")]).toBe("a > 0")
  })
})

describe("buildMigCsvRows — provenance and annotations", () => {
  const parent = mig(
    "Base",
    { "Doc/Amt": { additionalConstraints: [{ name: "Inherited", definition: "From base" }] } },
    { version: "1.0" },
  )
  const leaf = mig(
    "Leaf",
    {
      "Doc/Amt": {
        additionalConstraints: [
          { name: "Own", definition: "From leaf", annotations: { Usage: "Mandatory" } },
        ],
      },
    },
    { version: "2.0", parentMIG: "Base:1.0", constraintAnnotationNames: ["Usage"] },
  )

  it("attributes inherited rules to the parent MIG and own rules to MIG", () => {
    const { columns, rows } = buildMigCsvRows(leaf, [leaf, parent], MESSAGE)
    const inherited = rows.find((r) => r[col(columns, "Rule")] === "Inherited")!
    const own = rows.find((r) => r[col(columns, "Rule")] === "Own")!
    expect(inherited[col(columns, "Source")]).toBe("Base")
    expect(own[col(columns, "Source")]).toBe("Leaf")
  })

  it("strips the message identifier / short code from the Source MIG name", () => {
    const base = mig(
      "pacs.008 Base",
      { "Doc/Amt": { additionalConstraints: [{ name: "Inh", definition: "x" }] } },
      { version: "1.0" },
    )
    const top = mig(
      "pacs.008.001.08 EPC SCT",
      { "Doc/Amt": { additionalConstraints: [{ name: "Mine", definition: "y" }] } },
      { version: "2.0", parentMIG: "pacs.008 Base:1.0" },
    )
    const { columns, rows } = buildMigCsvRows(top, [top, base], MESSAGE)
    expect(rows.find((r) => r[col(columns, "Rule")] === "Mine")![col(columns, "Source")]).toBe(
      "EPC SCT",
    )
    expect(rows.find((r) => r[col(columns, "Rule")] === "Inh")![col(columns, "Source")]).toBe("Base")
  })

  it("adds one column per constraint annotation and fills it", () => {
    const { columns, rows } = buildMigCsvRows(leaf, [leaf, parent], MESSAGE)
    expect(columns).toContain("Usage")
    const own = rows.find((r) => r[col(columns, "Rule")] === "Own")!
    expect(own[col(columns, "Usage")]).toBe("Mandatory")
  })
})

describe("buildMigCsv", () => {
  it("renders RFC4180 CSV, quoting fields with commas or quotes", () => {
    const { content, filename } = buildMigCsv(
      mig("M", {
        "Doc/Amt": { additionalConstraints: [{ name: "R", definition: 'a, b and "c"' }] },
      }),
      [],
      MESSAGE,
    )
    expect(filename).toBe("M-1.0.csv")
    expect(content.endsWith("\r\n")).toBe(true)
    expect(content).toContain('M,R,"a, b and ""c"""')
  })
})
