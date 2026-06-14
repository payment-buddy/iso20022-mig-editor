// A minimal, dependency-light writer for the Office Open XML SpreadsheetML
// format (`.xlsx`) — just enough to emit a single styled worksheet. An xlsx file
// is a zip of XML parts, so we build the parts as strings and zip them with
// fflate (already a dependency, so no meaningful bundle cost and fully offline).
//
// Scope on purpose: one sheet, inline string cells only (no shared-string table,
// no number/date typing), per-row solid background fills and font colors, a bold
// frozen header row, and word-wrapped top-aligned body cells. Pure TypeScript —
// no DOM — so it stays unit-testable in isolation.

import { strToU8, zipSync } from "fflate"

export interface XlsxColumn {
  title: string
  /** Column width in Excel "character" units; omitted → Excel default. */
  width?: number
}

export interface XlsxRow {
  /** One string per column (short rows are padded, long rows truncated). */
  cells: string[]
  /** Solid background fill as a 6-digit RGB hex (no `#`); omitted → no fill. */
  fill?: string | null
  /** Font color as a 6-digit RGB hex (no `#`); omitted → default text color. */
  fontColor?: string | null
}

export interface XlsxSheet {
  name: string
  columns: XlsxColumn[]
  rows: XlsxRow[]
}

/** A distinct (fill, fontColor) combination a row can carry. */
interface StyleSpec {
  fill: string | null
  fontColor: string | null
}

const specKey = (s: StyleSpec) => `${s.fill ?? ""} ${s.fontColor ?? ""}`

/** Background fill of the (bold, frozen) header row. */
const HEADER_FILL = "D9D9D9"

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

function escapeXml(s: string): string {
  return s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"
  )
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  )
}

/** 0-based column index → spreadsheet column letters (0→A, 25→Z, 26→AA). */
export function columnLetter(index: number): string {
  let n = index + 1
  let letters = ""
  while (n > 0) {
    const rem = (n - 1) % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

/** A 6-hex RGB (e.g. `D1FAE5`) as the opaque ARGB Excel wants (`FFD1FAE5`). */
const argb = (rgb: string) => "FF" + rgb.toUpperCase()

const solidFill = (rgb: string) =>
  `<fill><patternFill patternType="solid"><fgColor rgb="${argb(
    rgb
  )}"/></patternFill></fill>`

/**
 * Build `styles.xml` plus a lookup from a row's (fill, fontColor) to its cellXf
 * index. Reserved Excel slots come first — fonts: 0 = default, 1 = bold (header);
 * fills: 0 = none, 1 = gray125, 2 = header. Then one font per distinct font color
 * and one fill per distinct background, and one cellXf per distinct spec.
 */
function buildStyles(specs: StyleSpec[]): {
  xml: string
  styleIndexFor: (fill?: string | null, fontColor?: string | null) => number
} {
  const fillColors = [...new Set(specs.map((s) => s.fill).filter(Boolean))]
  const fontColors = [...new Set(specs.map((s) => s.fontColor).filter(Boolean))]
  const fillToId = new Map(fillColors.map((c, i) => [c, 3 + i]))
  const fontToId = new Map(fontColors.map((c, i) => [c, 2 + i]))

  const fontXml = [
    '<font><sz val="11"/><name val="Calibri"/></font>',
    '<font><b/><sz val="11"/><name val="Calibri"/></font>',
    ...fontColors.map(
      (c) =>
        `<font><color rgb="${argb(c!)}"/><sz val="11"/><name val="Calibri"/></font>`
    ),
  ]
  const fillXml = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    solidFill(HEADER_FILL),
    ...fillColors.map((c) => solidFill(c!)),
  ]

  const wrap = '<alignment vertical="top" wrapText="1"/>'
  // cellXfs always emitted: 0 = default, 1 = header, 2 = body (no fill/color).
  const baseXfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${wrap}</xf>`,
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">${wrap}</xf>`,
  ]
  const specToXf = new Map<string, number>()
  const specXfs = specs.map((s, i) => {
    specToXf.set(specKey(s), baseXfs.length + i)
    const fontId = s.fontColor ? fontToId.get(s.fontColor)! : 0
    const fillId = s.fill ? fillToId.get(s.fill)! : 0
    const applyFont = fontId ? ' applyFont="1"' : ""
    const applyFill = fillId ? ' applyFill="1"' : ""
    return `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"${applyFont}${applyFill} applyAlignment="1">${wrap}</xf>`
  })
  const cellXfs = [...baseXfs, ...specXfs]

  const xml =
    XML_HEADER +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<fonts count="${fontXml.length}">${fontXml.join("")}</fonts>` +
    `<fills count="${fillXml.length}">${fillXml.join("")}</fills>` +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${cellXfs.length}">${cellXfs.join("")}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"

  return {
    xml,
    styleIndexFor: (fill, fontColor) =>
      !fill && !fontColor
        ? 2
        : (specToXf.get(
            specKey({ fill: fill ?? null, fontColor: fontColor ?? null })
          ) ?? 2),
  }
}

function cellXml(ref: string, style: number, value: string): string {
  if (value === "") return `<c r="${ref}" s="${style}"/>`
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    value
  )}</t></is></c>`
}

function rowXml(
  rowNumber: number,
  cells: string[],
  columnCount: number,
  style: number
): string {
  const out: string[] = []
  for (let c = 0; c < columnCount; c++) {
    const ref = `${columnLetter(c)}${rowNumber}`
    out.push(cellXml(ref, style, cells[c] ?? ""))
  }
  return `<row r="${rowNumber}">${out.join("")}</row>`
}

function sheetXml(sheet: XlsxSheet, styles: ReturnType<typeof buildStyles>) {
  const colCount = sheet.columns.length
  const lastRef = `${columnLetter(Math.max(0, colCount - 1))}${
    sheet.rows.length + 1
  }`

  const cols = sheet.columns.some((c) => c.width != null)
    ? "<cols>" +
      sheet.columns
        .map((c, i) =>
          c.width != null
            ? `<col min="${i + 1}" max="${i + 1}" width="${
                c.width
              }" customWidth="1"/>`
            : ""
        )
        .join("") +
      "</cols>"
    : ""

  const header = rowXml(
    1,
    sheet.columns.map((c) => c.title),
    colCount,
    1
  )
  const body = sheet.rows.map((r, i) =>
    rowXml(i + 2, r.cells, colCount, styles.styleIndexFor(r.fill, r.fontColor))
  )

  return (
    XML_HEADER +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${lastRef}"/>` +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    "</sheetView></sheetViews>" +
    cols +
    `<sheetData>${header}${body.join("")}</sheetData>` +
    "</worksheet>"
  )
}

/** Excel forbids these in a sheet name, and caps it at 31 chars. */
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, " ").trim() || "Sheet1"
  return cleaned.slice(0, 31)
}

/** Distinct (fill, fontColor) style specs used across every sheet's rows. */
function collectSpecs(sheets: XlsxSheet[]): StyleSpec[] {
  const seen = new Set<string>()
  const specs: StyleSpec[] = []
  for (const sheet of sheets)
    for (const r of sheet.rows) {
      if (!r.fill && !r.fontColor) continue
      const spec: StyleSpec = {
        fill: r.fill ?? null,
        fontColor: r.fontColor ?? null,
      }
      const key = specKey(spec)
      if (!seen.has(key)) {
        seen.add(key)
        specs.push(spec)
      }
    }
  return specs
}

/** Excel sheet names must be unique (case-insensitively) and ≤31 chars. */
function uniqueSheetNames(sheets: XlsxSheet[]): string[] {
  const used = new Set<string>()
  return sheets.map((s) => {
    const base = sanitizeSheetName(s.name)
    let name = base
    let n = 2
    while (used.has(name.toLowerCase())) {
      const suffix = ` ${n++}`
      name = base.slice(0, 31 - suffix.length) + suffix
    }
    used.add(name.toLowerCase())
    return name
  })
}

/** Encode one styled worksheet as an `.xlsx` byte stream. */
export function writeXlsx(sheet: XlsxSheet): Uint8Array {
  return writeXlsxWorkbook([sheet])
}

/**
 * Encode several styled worksheets into one `.xlsx` workbook. All sheets share a
 * single style table (so a row's fill/color resolves the same everywhere) and
 * get Excel-unique names.
 */
export function writeXlsxWorkbook(sheets: XlsxSheet[]): Uint8Array {
  const styles = buildStyles(collectSpecs(sheets))
  const names = uniqueSheetNames(sheets)
  const sheetPart = (i: number) => `xl/worksheets/sheet${i + 1}.xml`
  const stylesRid = sheets.length + 1

  const contentTypes =
    XML_HEADER +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets
      .map(
        (_, i) =>
          `<Override PartName="/${sheetPart(
            i
          )}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("") +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    "</Types>"

  const rootRels =
    XML_HEADER +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>"

  const workbook =
    XML_HEADER +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    "<sheets>" +
    names
      .map(
        (nm, i) =>
          `<sheet name="${escapeAttr(nm)}" sheetId="${i + 1}" r:id="rId${
            i + 1
          }"/>`
      )
      .join("") +
    "</sheets>" +
    "</workbook>"

  const workbookRels =
    XML_HEADER +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${
            i + 1
          }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
            i + 1
          }.xml"/>`
      )
      .join("") +
    `<Relationship Id="rId${stylesRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    "</Relationships>"

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRels),
    "xl/styles.xml": strToU8(styles.xml),
  }
  sheets.forEach((sheet, i) => {
    files[sheetPart(i)] = strToU8(sheetXml(sheet, styles))
  })
  return zipSync(files)
}
