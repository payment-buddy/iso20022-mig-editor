// Render a MIG as a human-readable, git-native Markdown report: the effective
// overlay (this MIG + parent chain) diffed against the ISO message, in schema
// order. Diffable and renders on GitHub. Pure — no DOM.

import { effectiveMig } from "./effectiveMig"
import { diffMig, type ElementDiff, type MigDiff } from "./migDiff"
import type {
  MessageDefinition,
  MessageImplementationGuide,
} from "@/core/types/types"

/** Collapse whitespace and escape `|` so a string is safe inside a table cell. */
const cell = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|")

function renderElement(e: ElementDiff): string[] {
  const lines = [`### ${e.name}`, "", `\`${e.path}\``]

  if (e.orphan)
    lines.push(
      "",
      "_Not present in this message version; ISO baseline unknown._"
    )

  if (e.excluded) {
    lines.push("", "**Excluded** — removed from the message (`maxOccurs: 0`).")
    return lines
  }

  if (e.changes.length > 0) {
    lines.push(
      "",
      "| Field | ISO | This MIG | Change |",
      "| --- | --- | --- | --- |"
    )
    for (const c of e.changes) {
      lines.push(
        `| ${cell(c.label)} | ${cell(c.baseline)} | ${cell(c.value)} | ${c.kind} |`
      )
    }
  }

  if (e.constraints.length > 0) {
    lines.push("", "**Constraints**", "")
    for (const con of e.constraints) {
      // Tag overlays on standard/inherited rules and disabled rules.
      const tag = con.disabled
        ? " _(disabled)_"
        : con.source === "standard"
          ? " _(overridden)_"
          : ""
      lines.push(
        con.definition
          ? `- **${con.name}**${tag} — ${cell(con.definition)}`
          : `- **${con.name}**${tag}`
      )
      if (con.expression)
        lines.push(`  - Expression: \`${cell(con.expression)}\``)
      for (const a of con.annotations)
        lines.push(`  - ${cell(a.name)}: ${cell(a.value)}`)
    }
  }

  return lines
}

/** Render a computed {@link MigDiff} to Markdown (ends with a single newline). */
export function migMarkdown(diff: MigDiff): string {
  const lines = [`# ${diff.mig.name} ${diff.mig.version}`, ""]
  lines.push(
    `**Message:** ${diff.message.name} (\`${diff.message.identifier}\`)`
  )
  if (diff.mig.parents.length > 0)
    lines.push(`**Inherits:** ${diff.mig.parents.join(" → ")}`)
  if (diff.mig.description) lines.push("", diff.mig.description)

  if (diff.missingParent) {
    lines.push(
      "",
      `> ⚠️ Parent \`${diff.missingParent}\` is not loaded; its inherited constraints are omitted.`
    )
  }
  if (diff.loosenings > 0) {
    lines.push(
      "",
      `> ⚠️ ${diff.loosenings} field(s) are **looser** than the ISO standard.`
    )
  }

  if (diff.elements.length === 0) {
    lines.push("", "_This MIG makes no changes to the ISO message._")
  } else {
    for (const e of diff.elements) lines.push("", ...renderElement(e))
  }

  return lines.join("\n").replace(/\n+$/, "") + "\n"
}

/** Build the Markdown export for one MIG: effective overlay vs the ISO message. */
export function buildMigMarkdown(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[],
  message: MessageDefinition
): { filename: string; content: string } {
  const diff = diffMig(effectiveMig(mig, allMigs), message)
  return {
    filename: `${mig.name}-${mig.version}.md`,
    content: migMarkdown(diff),
  }
}
