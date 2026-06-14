// Zod validation for imported MIG YAML. The
// schema mirrors the `MessageImplementationGuide` interface in `types.ts` and is
// pinned to it with `satisfies z.ZodType<…>`, so a drift between the two is a
// compile error. Unknown keys (e.g. the exported `formatVersion`) are stripped.

import { z } from "zod"
import type { MessageImplementationGuide } from "@/core/types/types"

const constraint = z.object({
  name: z.string(),
  definition: z.string(),
  expression: z.string().optional(),
  annotations: z.record(z.string(), z.string().nullable()).optional(),
})

const constraintOverride = z.object({
  definition: z.string().nullable().optional(),
  expression: z.string().nullable().optional(),
  disabled: z.boolean().optional(),
})

const elementOverride = z.object({
  definition: z.string().nullable().optional(),
  minOccurs: z.number().nullable().optional(),
  maxOccurs: z.number().nullable().optional(),
  minInclusive: z.number().nullable().optional(),
  maxInclusive: z.number().nullable().optional(),
  totalDigits: z.number().nullable().optional(),
  fractionDigits: z.number().nullable().optional(),
  minLength: z.number().nullable().optional(),
  maxLength: z.number().nullable().optional(),
  pattern: z.string().nullable().optional(),
  allowedValues: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
  additionalConstraints: z.array(constraint).optional(),
  constraintOverrides: z.record(z.string(), constraintOverride).optional(),
})

export const migSchema = z.object({
  name: z.string(),
  version: z.string(),
  messageIdentifier: z.string(),
  parentMIG: z.string().optional(),
  description: z.string().optional(),
  elementAnnotationNames: z.array(z.string()).optional(),
  constraintAnnotationNames: z.array(z.string()).optional(),
  elementOverrides: z.record(z.string(), elementOverride),
}) satisfies z.ZodType<MessageImplementationGuide>

export type ImportResult =
  | { ok: true; mig: MessageImplementationGuide }
  | { ok: false; errors: string[] }

/** Readable `field.path: message` lines from a Zod error. */
function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".")
    return path ? `${path}: ${issue.message}` : issue.message
  })
}

/**
 * Validate one parsed YAML object as a MIG. On success returns the (extra-key-
 * stripped) MIG; on failure, readable error lines for the upload UI to surface.
 */
export function validateMigImport(value: unknown): ImportResult {
  const result = migSchema.safeParse(value)
  return result.success ? { ok: true, mig: result.data } : { ok: false, errors: formatIssues(result.error) }
}
