import { describe, expect, it } from "vitest"
import { strFromU8, unzipSync } from "fflate"
import type {
  Code,
  MessageDefinition,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import {
  buildMigExportRows,
  buildMigsXlsx,
  buildMigXlsx,
  fillForKind,
  fontColorForKind,
  stripCommonWordPrefix,
} from "./migXlsx"

function el(
  xmlTag: string,
  props: Partial<MessageElement> = {},
  elements: MessageElement[] = []
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

const codes = (...names: string[]): Code[] =>
  names.map((codeName) => ({ codeName, definition: "" }))

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
      el("Itm", { maxOccurs: null }, [
        el("Val", { baseType: "Text", type: "Text", maxLength: 4 }),
      ]),
    ]),
    el("Amt", {
      baseType: "Decimal",
      type: "Amount",
      totalDigits: 18,
      fractionDigits: 4,
      minOccurs: 0,
    }),
    el("Ccy", {
      baseType: "Text",
      type: "CurrencyCode",
      codes: codes("EUR", "USD", "NOK"),
    }),
    el("Dt", { baseType: "ISODateTime", type: "ISODateTime", minOccurs: 0 }),
  ]),
}

function mig(
  name: string,
  overrides: MessageImplementationGuide["elementOverrides"],
  extra: Partial<MessageImplementationGuide> = {}
): MessageImplementationGuide {
  return {
    name,
    version: "1.0",
    messageIdentifier: "pacs.008.001.08",
    elementOverrides: overrides,
    ...extra,
  }
}

/** Column index by header. */
function col(columns: string[], name: string): number {
  return columns.indexOf(name)
}

describe("buildMigExportRows — element rows", () => {
  it("emits one row per element in document order, with ISO structure and type", () => {
    const { columns, rows } = buildMigExportRows(mig("M", {}), [], MESSAGE)
    expect(columns.slice(0, 7)).toEqual([
      "Level",
      "Choice",
      "Name",
      "XML tag",
      "Path",
      "Multiplicity",
      "Type",
    ])

    // Element rows only (Level, Name, XML tag, Multiplicity, Type).
    const elementRows = rows.filter((r) => r.cells[col(columns, "Name")] !== "")
    expect(
      elementRows.map((r) => [
        r.cells[0],
        r.cells[2],
        r.cells[3],
        r.cells[5],
        r.cells[6],
      ])
    ).toEqual([
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

  it("labels a choice element and its options in the Choice column", () => {
    const choiceMsg: MessageDefinition = {
      name: "M",
      identifier: "pacs.008.001.08",
      shortCode: "pacs.008",
      rootElement: el("Doc", {}, [
        el("Pick", { isChoice: true }, [
          el("OptA", { baseType: "Text", type: "Text" }),
          el("OptB", { baseType: "Text", type: "Text" }),
        ]),
        el("Plain", { baseType: "Text", type: "Text" }),
      ]),
    }
    const { columns, rows } = buildMigExportRows(mig("M", {}), [], choiceMsg)
    const choiceOf = (name: string) =>
      rows.find((r) => r.cells[col(columns, "Name")] === name)!.cells[
        col(columns, "Choice")
      ]
    expect(choiceOf("Pick")).toBe("Choice")
    expect(choiceOf("OptA")).toBe("Option")
    expect(choiceOf("OptB")).toBe("Option")
    expect(choiceOf("Plain")).toBe("")
    expect(choiceOf("Doc")).toBe("")
  })

  it("renders Path as an indented multiline name tree, root skipped", () => {
    const { columns, rows } = buildMigExportRows(mig("M", {}), [], MESSAGE)
    const pathOf = (name: string) =>
      rows.find((r) => r.cells[col(columns, "Name")] === name)!.cells[
        col(columns, "Path")
      ]
    expect(pathOf("Doc")).toBe("") // root skipped
    expect(pathOf("GrpHdr")).toBe("+GrpHdr")
    expect(pathOf("Val")).toBe("+GrpHdr\n++Itm\n+++Val")
  })

  it("lists ISO constraints as rule rows sourced to ISO, uncolored", () => {
    const { columns, rows } = buildMigExportRows(mig("M", {}), [], MESSAGE)
    const r = rows.find((x) => x.cells[col(columns, "Rule")] === "Format")!
    expect(r.cells[col(columns, "Provenance")]).toBe("ISO")
    expect(r.cells[col(columns, "Definition")]).toBe("No leading spaces.")
    expect(r.kind).toBe("iso")
    expect(fillForKind(r.kind)).toBeNull()
    // Common columns are blank on a rule row.
    expect(r.cells.slice(0, 7)).toEqual(["", "", "", "", "", "", ""])
  })

  it("marks an overlaid ISO constraint as own (green), sourced to the MIG", () => {
    const m = mig("M", {
      "/Doc/GrpHdr/MsgId": {
        constraintOverrides: { Format: { expression: "matches(., '[A-Z]+')" } },
      },
    })
    const { columns, rows } = buildMigExportRows(m, [], MESSAGE)
    const r = rows.find((x) => x.cells[col(columns, "Rule")] === "Format")!
    expect(r.cells[col(columns, "Provenance")]).toBe("M") // overlaid → sourced to the MIG
    expect(r.kind).toBe("own")
    expect(fillForKind(r.kind)).toBe("D1FAE5")
  })

  it("marks a disabled ISO constraint gray with muted text", () => {
    const m = mig("M", {
      "/Doc/GrpHdr/MsgId": {
        constraintOverrides: { Format: { disabled: true } },
      },
    })
    const { columns, rows } = buildMigExportRows(m, [], MESSAGE)
    const r = rows.find(
      (x) => x.cells[col(columns, "Rule")] === "Format (disabled)"
    )!
    expect(r.cells[col(columns, "Provenance")]).toBe("M")
    expect(r.kind).toBe("disabled")
    expect(fillForKind(r.kind)).toBe("E5E7EB")
    expect(fontColorForKind(r.kind)).toBe("6B7280")
  })

  it("marks a disabled added constraint gray with muted text, like an ISO one", () => {
    const m = mig("M", {
      "/Doc/GrpHdr/MsgId": {
        additionalConstraints: [{ name: "MyRule", definition: "custom" }],
        constraintOverrides: { MyRule: { disabled: true } },
      },
    })
    const { columns, rows } = buildMigExportRows(m, [], MESSAGE)
    const r = rows.find(
      (x) => x.cells[col(columns, "Rule")] === "MyRule (disabled)"
    )!
    expect(r.kind).toBe("disabled")
    expect(fillForKind(r.kind)).toBe("E5E7EB")
    expect(fontColorForKind(r.kind)).toBe("6B7280")
  })

  it("tints an excluded element row gray with muted text", () => {
    const { columns, rows } = buildMigExportRows(
      mig("M", { "/Doc/Amt": { maxOccurs: 0 } }),
      [],
      MESSAGE
    )
    const amt = rows.find((r) => r.cells[col(columns, "Name")] === "Amt")!
    expect(amt.kind).toBe("excluded")
    expect(fillForKind(amt.kind)).toBe("E5E7EB")
    expect(fontColorForKind(amt.kind)).toBe("6B7280")
  })

  it("omits the Annotations column when no element annotation names are configured", () => {
    const { columns } = buildMigExportRows(
      mig("M", { "/Doc/Amt": { annotations: { Purpose: "Payment" } } }),
      [],
      MESSAGE
    )
    expect(columns).not.toContain("Annotations")
  })

  it("includes the Annotations column when element annotation names are configured", () => {
    const { columns, rows } = buildMigExportRows(
      mig(
        "M",
        { "/Doc/Amt": { annotations: { Purpose: "Payment", Note: "x" } } },
        { elementAnnotationNames: ["Purpose", "Note"] }
      ),
      [],
      MESSAGE
    )
    expect(columns).toContain("Annotations")
    // It sits between the element's Type and the rule Source columns.
    expect(col(columns, "Annotations")).toBe(col(columns, "Provenance") - 1)
    const amt = rows.find((r) => r.cells[col(columns, "Name")] === "Amt")!
    expect(amt.cells[col(columns, "Annotations")]).toBe(
      "Purpose: Payment\nNote: x"
    )
  })
})

describe("buildMigExportRows — overrides", () => {
  it("emits a Multiplicity rule with the overridden value, green/own", () => {
    const { columns, rows } = buildMigExportRows(
      mig("M", { "/Doc/Amt": { minOccurs: 1 } }),
      [],
      MESSAGE
    )
    const r = rows.find(
      (x) => x.cells[col(columns, "Rule")] === "Multiplicity"
    )!
    expect(r.cells[col(columns, "Provenance")]).toBe("M")
    expect(r.cells[col(columns, "Definition")]).toBe("[1..1]")
    expect(r.kind).toBe("own")
  })

  it("emits a Type rule with the overridden type in the Type format", () => {
    const { columns, rows } = buildMigExportRows(
      mig("M", { "/Doc/GrpHdr/MsgId": { maxLength: 20 } }),
      [],
      MESSAGE
    )
    const r = rows.find((x) => x.cells[col(columns, "Rule")] === "Type")!
    expect(r.cells[col(columns, "Provenance")]).toBe("M")
    expect(r.cells[col(columns, "Definition")]).toBe("Text[1..20]")
  })

  it("emits added constraints sourced to this MIG", () => {
    const { columns, rows } = buildMigExportRows(
      mig("M", {
        "/Doc/Amt": {
          additionalConstraints: [
            { name: "Positive", definition: "Must be > 0" },
          ],
        },
      }),
      [],
      MESSAGE
    )
    const r = rows.find((x) => x.cells[col(columns, "Rule")] === "Positive")!
    expect(r.cells[col(columns, "Provenance")]).toBe("M")
    expect(r.cells[col(columns, "Definition")]).toBe("Must be > 0")
    expect(r.kind).toBe("own")
  })
})

describe("buildMigExportRows — provenance and annotations", () => {
  const parent = mig(
    "Base",
    {
      "/Doc/Amt": {
        additionalConstraints: [{ name: "Inherited", definition: "From base" }],
      },
    },
    { version: "1.0" }
  )
  const leaf = mig(
    "Leaf",
    {
      "/Doc/Amt": {
        additionalConstraints: [
          {
            name: "Own",
            definition: "From leaf",
            annotations: { Usage: "Mandatory" },
          },
        ],
      },
    },
    {
      version: "2.0",
      parentMIG: "Base:1.0",
      constraintAnnotationNames: ["Usage"],
    }
  )

  it("tints inherited rules blue and own rules green", () => {
    const { columns, rows } = buildMigExportRows(leaf, [leaf, parent], MESSAGE)
    const inherited = rows.find(
      (r) => r.cells[col(columns, "Rule")] === "Inherited"
    )!
    const own = rows.find((r) => r.cells[col(columns, "Rule")] === "Own")!
    expect(inherited.cells[col(columns, "Provenance")]).toBe("Base")
    expect(inherited.kind).toBe("inherited")
    expect(fillForKind(inherited.kind)).toBe("DBEAFE")
    expect(own.cells[col(columns, "Provenance")]).toBe("Leaf")
    expect(own.kind).toBe("own")
  })

  it("adds one column per constraint annotation and fills it", () => {
    const { columns, rows } = buildMigExportRows(leaf, [leaf, parent], MESSAGE)
    expect(columns).toContain("Usage")
    const own = rows.find((r) => r.cells[col(columns, "Rule")] === "Own")!
    expect(own.cells[col(columns, "Usage")]).toBe("Mandatory")
  })
})

describe("buildMigXlsx", () => {
  it("produces a valid .xlsx zip with the expected parts and content", () => {
    const { content, filename } = buildMigXlsx(
      mig("M", {
        "/Doc/Amt": {
          additionalConstraints: [{ name: "R", definition: 'a, b and "c"' }],
        },
        // A disabled rule exercises the gray fill + muted text styling.
        "/Doc/GrpHdr/MsgId": {
          constraintOverrides: { Format: { disabled: true } },
        },
      }),
      [],
      MESSAGE
    )
    expect(filename).toBe("M-1.0.xlsx")

    const files = unzipSync(content)
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/workbook.xml",
        "xl/_rels/workbook.xml.rels",
        "xl/styles.xml",
        "xl/worksheets/sheet1.xml",
      ])
    )

    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"])
    // Header and a constraint value survive into the sheet (text keeps literal
    // quotes/commas; only & < > are escaped in inline-string content).
    expect(sheet).toContain("Multiplicity")
    expect(sheet).toContain('a, b and "c"')
    // The header row is frozen.
    expect(sheet).toContain('ySplit="1"')
    const styles = strFromU8(files["xl/styles.xml"])
    // The added constraint row is tinted green (own); the disabled rule carries
    // the gray "removed" fill and the muted text color.
    expect(styles).toContain("FFD1FAE5")
    expect(styles).toContain("FFE5E7EB")
    expect(styles).toContain("FF6B7280")
  })

  it("names the sheet after the message identifier", () => {
    const { content } = buildMigXlsx(mig("M", {}), [], MESSAGE)
    const workbook = strFromU8(unzipSync(content)["xl/workbook.xml"])
    expect(workbook).toContain('name="pacs.008.001.08"')
  })
})

describe("buildMigsXlsx", () => {
  it("returns null for an empty selection", () => {
    expect(buildMigsXlsx([], [])).toBeNull()
  })

  it("falls back to a single-sheet workbook for one MIG", () => {
    const file = buildMigsXlsx(
      [{ mig: mig("Solo", {}), message: MESSAGE }],
      []
    )!
    expect(file.filename).toBe("Solo-1.0.xlsx")
    const files = unzipSync(file.content)
    expect(files["xl/worksheets/sheet2.xml"]).toBeUndefined()
    // Single MIG keeps the message-identifier sheet name.
    expect(strFromU8(files["xl/workbook.xml"])).toContain(
      'name="pacs.008.001.08"'
    )
  })

  it("writes one sheet per MIG sharing one style table; names by MIG when message ids collide", () => {
    // Both MIGs target the same message, so identifiers aren't unique → fall back
    // to the (distinct) MIG names.
    const a = mig("EPC", {
      "/Doc/Amt": {
        additionalConstraints: [{ name: "Pos", definition: "> 0" }],
      },
    })
    const b = mig("CBPR", {})
    const file = buildMigsXlsx(
      [
        { mig: a, message: MESSAGE },
        { mig: b, message: MESSAGE },
      ],
      [a, b]
    )!
    expect(file.filename).toBe("MessageImplementationGuides.xlsx")
    const files = unzipSync(file.content)
    // Two worksheet parts, one shared styles part.
    expect(files["xl/worksheets/sheet1.xml"]).toBeDefined()
    expect(files["xl/worksheets/sheet2.xml"]).toBeDefined()
    expect(files["xl/worksheets/sheet3.xml"]).toBeUndefined()
    const workbook = strFromU8(files["xl/workbook.xml"])
    expect(workbook).toContain('name="EPC"')
    expect(workbook).toContain('name="CBPR"')
    // The green "own" fill lives in the single shared style table.
    expect(strFromU8(files["xl/styles.xml"])).toContain("FFD1FAE5")
  })

  it("names sheets by message identifier when those are unique", () => {
    const msg2: MessageDefinition = {
      ...MESSAGE,
      identifier: "pacs.009.001.08",
      shortCode: "pacs.009",
    }
    const file = buildMigsXlsx(
      [
        { mig: mig("EPC SCT", {}), message: MESSAGE },
        { mig: mig("EPC CBPR", {}), message: msg2 },
      ],
      []
    )!
    const workbook = strFromU8(unzipSync(file.content)["xl/workbook.xml"])
    // Identifiers win — the MIG names (which share "EPC") are not used.
    expect(workbook).toContain('name="pacs.008.001.08"')
    expect(workbook).toContain('name="pacs.009.001.08"')
    expect(workbook).not.toContain("EPC")
  })

  it("disambiguates duplicate sheet names", () => {
    const file = buildMigsXlsx(
      [
        { mig: mig("Dup", {}), message: MESSAGE },
        { mig: mig("Dup", {}, { version: "2.0" }), message: MESSAGE },
      ],
      []
    )!
    const workbook = strFromU8(unzipSync(file.content)["xl/workbook.xml"])
    expect(workbook).toContain('name="Dup"')
    expect(workbook).toContain('name="Dup 2"')
  })

  it("strips the common leading words from the sheet tabs", () => {
    const file = buildMigsXlsx(
      [
        { mig: mig("pacs.008 EPC SCT", {}), message: MESSAGE },
        { mig: mig("pacs.008 EPC Inst", {}), message: MESSAGE },
      ],
      []
    )!
    const workbook = strFromU8(unzipSync(file.content)["xl/workbook.xml"])
    expect(workbook).toContain('name="SCT"')
    expect(workbook).toContain('name="Inst"')
    expect(workbook).not.toContain("EPC")
  })
})

describe("stripCommonWordPrefix", () => {
  it("strips the shared leading whole words", () => {
    expect(stripCommonWordPrefix(["EPC SCT Core", "EPC SCT Plus"])).toEqual([
      "Core",
      "Plus",
    ])
  })

  it("splits words on dashes too", () => {
    expect(
      stripCommonWordPrefix(["pacs.008-EPC-SCT", "pacs.008-EPC-Inst"])
    ).toEqual(["SCT", "Inst"])
    // Mixed dash/space separators.
    expect(stripCommonWordPrefix(["EPC-SCT Core", "EPC-SCT Plus"])).toEqual([
      "Core",
      "Plus",
    ])
  })

  it("only strips whole words, not partial matches", () => {
    // "EPCISH" and "EPC" share the prefix word "EPC" only when whole.
    expect(stripCommonWordPrefix(["EPC SCT", "EPCISH SCT"])).toEqual([
      "EPC SCT",
      "EPCISH SCT",
    ])
  })

  it("leaves names unchanged when there is no shared prefix", () => {
    expect(stripCommonWordPrefix(["EPC", "CBPR"])).toEqual(["EPC", "CBPR"])
  })

  it("keeps the full name when stripping would empty it", () => {
    // "EPC SCT" is exactly the common prefix → kept whole; the other is stripped.
    expect(stripCommonWordPrefix(["EPC SCT", "EPC SCT Inst"])).toEqual([
      "EPC SCT",
      "Inst",
    ])
  })

  it("returns a single name unchanged", () => {
    expect(stripCommonWordPrefix(["EPC SCT"])).toEqual(["EPC SCT"])
  })
})
