# MIG File Format

> The on-disk format for a Message Implementation Guide. Designed to be **git-native**:
> deterministic, readable, and diff-stable. One MIG per file.
>
> Status: agreed during redesign review. Mark up to change.

---

## 1. File conventions

- **One MIG per file.** The array form is reserved for backup / bulk export, never the committed artifact.
- **`formatVersion`** at the top — migration anchor for future format changes.
- **No volatile metadata** in the file (no `createdAt` / `updatedAt` / `author`). Git history and the in-app edit
  history cover that; timestamps would churn `git blame`.
- File ends with a **trailing newline**, 2-space indentation.

## 2. Serialization rules (diff-stability)

These produce stable, reviewable diffs and are **not optional** — they're the contract:

- **Deterministic field order** (see §3, §4) — same data always serializes identically.
- **`elementOverrides` ordered by message schema (document) order**, parents before children — *not* alphabetical.
  Requires the message definition in scope at export (precompute a `path → ordinal` index). Rationale: the file reads
  like the message; a new override lands next to its neighbors instead of mid-file.
- **No line wrapping:** `lineWidth: 0`. Long text never auto-reflows, so a one-word edit doesn't rewrite a whole
  paragraph.
- **Multi-line strings as block literals** (`|`/`|-`), for line-by-line diffs.
- **No anchors/aliases:** `aliasDuplicateObjects: false`.
- **Omit absent keys**, but **preserve explicit `null`** (see §5 — null is meaningful).

Concretely, the `yaml` `stringify` options:

```js
stringify(mig, {
    lineWidth: 0,
    aliasDuplicateObjects: false,
    indent: 2,
})
// + ensure trailing newline. Do NOT strip null. (undefined keys are omitted naturally.)
// The lib's defaults already give block literals (|) for multi-line strings and
// keep single-line strings plain/quoted — do NOT force defaultStringType, or every
// scalar (name, version, …) becomes an ugly one-line block literal.
```

## 3. Top-level structure & field order

```yaml
formatVersion: 1
name: <string>                     # identity = name:version
version: <string>
messageIdentifier: <string>        # e.g. pacs.008.001.08 (exact version)
parentMIG: <name:version | absent> # optional inheritance reference
description: <string | absent>
elementAnnotationNames: [ ... ]    # optional; custom-property names for elements (see §4.1)
constraintAnnotationNames: [ ... ] # optional; custom-property names for constraints (see §4.1)
elementOverrides:
  <xmlPath>: <ElementOverride>
  ...
```

## 4. ElementOverride structure & field order

Keyed by full XML path from the root (e.g. `/Document/FIToFICstmrCdtTrf/GrpHdr/CreDtTm`). Field order:

```
definition
minOccurs
maxOccurs          # maxOccurs: 0 means EXCLUDED (kept as-is, ISO convention)
minInclusive
maxInclusive
totalDigits
fractionDigits
minLength
maxLength
pattern
allowedValues      # list
examples           # list
annotations        # map; element custom properties (see §4.1)
additionalConstraints:    # map; MIG-added constraints, keyed by constraint name
  <constraint name>:
    definition
    expression            # optional; formal rule expression (omitted when empty)
    enabled               # optional bool; false skips the rule during validation (absent = active)
    annotations           # map; constraint custom properties (see §4.1)
constraintOverrides:      # map; overlays on standard/inherited constraints, keyed by constraint name
  <constraint name>:
    definition            # tri-state; overlay the rule's definition text
    expression            # tri-state; overlay a formal expression on an ISO/inherited rule
    disabled              # optional bool; true skips the rule during validation
    annotations           # map; per-name overlay on the constraint's annotations (see §4.1)
```

- **Exclusion** stays as **`maxOccurs: 0`** (no separate `excluded` flag).
- `additionalConstraints` entries are keyed by constraint name (sorted) and carry the field order
  `definition, expression, enabled, annotations` — mirroring `constraintOverrides`, the name lives in the map key, not a
  field. `expression` is an optional formal rule expression, omitted when empty. `enabled` is an optional **bool**: a MIG
  disables one of its **own** added rules with `enabled: false` (kept in the file but not enforced) — the off switch sits
  on the constraint itself, not in a `constraintOverrides` entry (that map is only for standard/inherited rules). `true`
  is the default and never written.
- `constraintOverrides` overlay fields onto a **standard (ISO) or inherited** constraint of the same name (it does not
  create one): `definition` and `expression` are tri-state (§5), plus a `disabled` **bool** (`true` skips the rule
  during validation; absent = active) and an `annotations` overlay (tri-state per name, like an `ElementOverride`'s — it
  lets a MIG override a single inherited constraint annotation without re-owning the whole constraint). Entries are keyed
  by constraint name, sorted; empty entries and an empty map are dropped.

### 4.1 Annotations (custom properties)

Elements and constraints each have an **independent** set of custom properties:

- **Declared once, MIG-wide** as ordered name lists: `elementAnnotationNames` (for element overrides) and
  `constraintAnnotationNames` (for the entries in `additionalConstraints`). The two lists are unrelated — the same label
  may appear in both, or in neither, with no shared meaning.
- **Valued per target** in an `annotations` map: one on each `ElementOverride` (keyed by element-annotation names),
  one on each `additionalConstraints` entry, and one on each `constraintOverrides` entry (both keyed by
  constraint-annotation names). The latter overlays the annotations of a **standard or inherited** constraint, so a MIG
  can override one inherited constraint annotation in place; the effective value is the base constraint's annotation
  overlaid by the `constraintOverrides` one (per name, `null`/absent clears). The two map kinds differ in type:
  element-override values are plain strings (`Record<string, string>`), while constraint values are nullable (
  `Record<string, string | null>`) — a stored constraint `null` is a real (rare) state that **serializes as `Name: null`
  **, not dropped.
- **Only set values are stored.** The editor drops a key when its value is cleared, and an emptied map drops the
  `annotations` key entirely (keeps the file minimal, like any other redundant override — §5). The serializer itself
  only drops an *empty* map — it does not strip individual `null` values (see the constraint-`null` case above).
  Removing a declared name strips that key from **every** target of its kind. A constraint always survives this (it
  still has `name`/`definition`); an element override survives too — unless the strip leaves it empty, in which case
  it's pruned like any redundant override (§5).
- **Ordering:** each `annotations` map serializes in its **declared-name order, then alphabetical** for any leftover
  keys — using the matching list (`elementAnnotationNames` for element maps, `constraintAnnotationNames` for constraint
  maps). A stored value whose name isn't (or is no longer) declared sorts into that alphabetical tail and isn't surfaced
  in the editor until the name is (re)declared.

## 5. Inherit / unset / set — the tri-state ⚠️ (key semantics)

Each override field is **tri-state**:

| In YAML            | Meaning                                                                                                  |
|--------------------|----------------------------------------------------------------------------------------------------------|
| **key absent**     | **Inherit** — value from the parent-MIG chain, or the ISO standard if no parent sets it.                 |
| **`key: null`**    | **Remove** — drop the constraint entirely for this field; it becomes **unconstrained** (no restriction). |
| **`key: <value>`** | **Set** — use this value.                                                                                |

`null` **removes the constraint completely** — it does *not* revert to the ISO standard value, and the result may be *
*looser than the standard** (which the consistency validator will flag as a warning, since it's still allowed). It
overrides the entire inherited chain *and* any standard-imposed bound for that field.

Chain example (EPC → CSM → bank): EPC sets `RmtInf/Ustrd.maxLength: 70`. The bank writing `maxLength: null` removes the
length constraint entirely (no max length) — distinct from omitting the key (inherit `70`).

For `allowedValues` specifically, `null` removes the MIG-imposed value list (no value restriction). For a CodeSet
element the valid universe remains the ISO code set, so in practice this equals "any standard code."

### Implementation consequences

1. **Serializer preserves `null`** (do not strip it). Absent keys are `undefined` in the model and omitted naturally.
2. **Merge uses key-presence, not `??`:** `result.x = ('x' in current) ? current.x : parent.x`, so an explicit `null` in
   a descendant beats an ancestor's value.
3. **Effective-value layer treats merged `null` as "no constraint"** (unconstrained / unbounded) when computing the
   value in force — tree display, consistency validation, message-instance validation. Not the standard value.

### Notes / edges & per-field exceptions

- **`definition` — the editor never writes `null`.** To blank an inherited definition, set an **empty string** (
  `definition: ''`); absent = inherit. (Three editor states: inherit / blank / text.) Note this is an *editor*
  convention, not a format constraint — the schema types `definition` as `string | null` like the other fields, so a
  hand-authored `definition: null` parses (and merges as "remove") rather than being rejected.
- **Cardinality:** `maxOccurs: null` → **unbounded**; `minOccurs: null` → **0**. Structural — normally set explicit
  values rather than `null`.
- **Empty array `[]` is coerced to absent, not preserved.** To remove a list restriction (`allowedValues`, `examples`)
  use `null`; an empty array is *not* rejected on import but is silently treated as absent (inherit) on the next
  serialize, since an empty allow-list ("nothing permitted") isn't a meaningful MIG statement.
- **Avoid redundant overrides.** The editor and serializer prune *empty* overrides (an override object, list, or
  annotations map with no entries → dropped). They do **not** compare a set value against the inherited chain, so a
  field whose value happens to equal its inherited value is still written; keeping such values out of the file is the
  editor's responsibility, not an automatic serialization step.

## 6. Example

```yaml
formatVersion: 1
name: BankX-SCTInst
version: '1.0'
messageIdentifier: pacs.008.001.08
parentMIG: EPC-SCTInst:2023
description: |-
  Bank X community profile for SEPA Instant Credit Transfer.
  Tightens EPC rules; lifts the EPC charge-bearer restriction.
constraintAnnotationNames: [ Severity ]   # custom property declared for constraints (§4.1)
elementOverrides:
  # Group Header › Creation Date Time
  /Document/FIToFICstmrCdtTrf/GrpHdr/CreDtTm:
    maxOccurs: 0                 # excluded
  # Credit Transfer Transaction › Charge Bearer
  /Document/FIToFICstmrCdtTrf/CdtTrfTxInf/ChrgBr:
    allowedValues: null          # remove EPC's value-list restriction (any ISO code)
  # Credit Transfer Transaction › Remittance Information › Unstructured
  /Document/FIToFICstmrCdtTrf/CdtTrfTxInf/RmtInf/Ustrd:
    maxLength: 140
    definition: |-
      Unstructured remittance information, limited to 140 characters
      for Bank X straight-through processing.
    additionalConstraints:
      NoMandateReference:
        definition: |-
          Ustrd must not carry a mandate reference under Bank X rules.
        expression: not(contains(Ustrd, 'MANDATE'))  # optional formal rule
        annotations:
          Severity: error        # value for the declared constraint annotation
```

Reading top-to-bottom follows the message; the definition won't reflow on edit; `null` vs absent is explicit.
