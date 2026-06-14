// Tokenizer for the constraint expression grammar (see `ast.ts`). Hand-rolled —
// the grammar is tiny and this keeps the bundle dependency-free.

/** A syntax error with the source span it points at. Thrown by lexer + parser. */
export class ExprSyntaxError extends Error {
  readonly start: number
  readonly end: number
  constructor(message: string, start: number, end: number) {
    super(message)
    this.name = "ExprSyntaxError"
    this.start = start
    this.end = end
  }
}

export type TokenType =
  | "name" // path step or function name
  | "string" // single-quoted literal
  | "number" // numeric literal
  | "op" // one of: = != < <= > >= ( ) , /
  | "kw" // boolean keyword: and / or

export interface Token {
  type: TokenType
  /** Raw lexeme, except `string` tokens carry the unquoted/unescaped value. */
  value: string
  start: number
  end: number
}

const KEYWORDS = new Set(["and", "or"])

const isNameStart = (c: string) => /[A-Za-z_]/.test(c)
const isNameChar = (c: string) => /[A-Za-z0-9_.-]/.test(c)
const isDigit = (c: string) => c >= "0" && c <= "9"
const isSpace = (c: string) =>
  c === " " || c === "\t" || c === "\n" || c === "\r"

/**
 * Split `src` into tokens. Whitespace is skipped. Throws `ExprSyntaxError` on an
 * illegal character or an unterminated string literal.
 */
export function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = src.length

  while (i < n) {
    const c = src[i]

    if (isSpace(c)) {
      i++
      continue
    }

    // String literal: single quotes, with '' as an escaped quote.
    if (c === "'") {
      const start = i
      i++
      let value = ""
      let closed = false
      while (i < n) {
        if (src[i] === "'") {
          if (src[i + 1] === "'") {
            value += "'"
            i += 2
            continue
          }
          i++
          closed = true
          break
        }
        value += src[i]
        i++
      }
      if (!closed)
        throw new ExprSyntaxError("Unterminated string literal", start, n)
      tokens.push({ type: "string", value, start, end: i })
      continue
    }

    // Number literal.
    if (isDigit(c)) {
      const start = i
      while (i < n && isDigit(src[i])) i++
      if (src[i] === "." && isDigit(src[i + 1])) {
        i++
        while (i < n && isDigit(src[i])) i++
      }
      tokens.push({ type: "number", value: src.slice(start, i), start, end: i })
      continue
    }

    // Name / keyword. A leading `@` marks an attribute step (e.g. `@Ccy`) and is
    // kept as part of the name token; the parser strips it.
    if (isNameStart(c) || c === "@") {
      const start = i
      if (c === "@") i++
      if (i >= n || !isNameStart(src[i])) {
        throw new ExprSyntaxError(
          "Expected an attribute name after '@'",
          start,
          i
        )
      }
      while (i < n && isNameChar(src[i])) i++
      const value = src.slice(start, i)
      tokens.push({
        type: KEYWORDS.has(value) ? "kw" : "name",
        value,
        start,
        end: i,
      })
      continue
    }

    // Multi-char operators first.
    if (c === "!" && src[i + 1] === "=") {
      tokens.push({ type: "op", value: "!=", start: i, end: i + 2 })
      i += 2
      continue
    }
    if ((c === "<" || c === ">") && src[i + 1] === "=") {
      tokens.push({ type: "op", value: c + "=", start: i, end: i + 2 })
      i += 2
      continue
    }
    if (
      c === "=" ||
      c === "<" ||
      c === ">" ||
      c === "(" ||
      c === ")" ||
      c === "," ||
      c === "/"
    ) {
      tokens.push({ type: "op", value: c, start: i, end: i + 1 })
      i++
      continue
    }

    throw new ExprSyntaxError(
      `Unexpected character ${JSON.stringify(c)}`,
      i,
      i + 1
    )
  }

  return tokens
}
