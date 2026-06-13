import { ArrowCounterClockwise } from "@phosphor-icons/react"
import type { ElementOverride, MessageElement } from "@/core/types/types"
import { InlineEdit } from "@/components/ui/inline-edit"
import { DetailPanel, Field } from "@/features/repository/ElementTree"

/**
 * Element detail/edit panel for the MIG Editor (FUNCTIONALITY §5.7). Read-only
 * identity fields plus the first editable override: **Definition**, shown with
 * its inherited baseline and an overridden flag + reset-to-inherited affordance.
 * Further override fields (occurs, length, …) land in later slices.
 */
export function MigElementDetail({
  element,
  path,
  override,
  onSet,
  onReset,
}: {
  element: MessageElement
  path: string
  override: ElementOverride | undefined
  /** Persist a definition override. */
  onSet: (text: string) => void
  /** Drop the definition override (back to inherited). */
  onReset: () => void
}) {
  const baseline = element.definition
  // Key-presence, not truthiness: a stored `null` still counts as overridden.
  const overridden = override !== undefined && "definition" in override
  const effective = overridden ? (override.definition ?? "") : baseline

  // Committing the inherited value is the same as not overriding at all.
  const commit = (text: string) => (text === baseline ? onReset() : onSet(text))

  return (
    <DetailPanel label="Element details">
      <div className="font-medium">{element.name}</div>
      <Field label={element.isAttribute ? "XML attribute" : "XML tag"}>
        <code className="text-xs">{element.xmlTag}</code>
      </Field>
      <Field label="XML path">
        <code className="text-xs">{path}</code>
      </Field>
      <Field label="Type">
        {element.type}
        {element.baseType && <span className="text-muted-foreground"> ({element.baseType})</span>}
      </Field>
      <Field label="Multiplicity">
        [{element.minOccurs}..{element.maxOccurs ?? "unbounded"}]
      </Field>

      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">
            Definition
          </div>
          {overridden && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 rounded-sm text-[0.625rem] text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <ArrowCounterClockwise className="size-3" aria-hidden />
              Reset to inherited
            </button>
          )}
        </div>
        <InlineEdit
          value={effective}
          onCommit={commit}
          ariaLabel="Definition"
          placeholder="Add a definition…"
          multiline
        />
        {overridden && (
          <p className="mt-1 px-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Overridden.</span>{" "}
            {baseline ? (
              <>
                Inherited: <span className="whitespace-pre-wrap">{baseline}</span>
              </>
            ) : (
              <>No inherited definition.</>
            )}
          </p>
        )}
      </div>
    </DetailPanel>
  )
}
