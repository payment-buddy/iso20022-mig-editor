# ISO 20022 MIG Editor

A browser-only, offline-first tool for exploring ISO 20022 financial message
definitions and authoring **Message Implementation Guides (MIGs)** — versioned
overlays that constrain a standard message for a specific use.

> **WARNING!** \
> Your data (MIGs, e-Repository content) is stored **only in your browser**, not online. \
> Clearing your browser data — or using private/incognito mode — erases it. \
> Back up your MIGs as YAML regularly.

## What it does

- **Browse** the e-Repository — business areas, messages, and their full element
  trees with data types, constraints, and code lists.
- **Author MIGs** — override an element's occurrences, facets, allowed values,
  examples, annotations, and constraints. Overrides are tri-state: inherit the
  standard, set a new value, or explicitly remove a constraint.
- **Inherit** — a MIG can extend a parent MIG; the effective overlay is the chain
  flattened ancestor→leaf. The motivating case is a chain of community rulebooks
  that each tighten the previous one — e.g. **EPC rulebook → CSM rules → bank
  community rules** — so a bank's MIG inherits the scheme and clearing-system
  constraints and states only its own deltas.
- **Track history** — every edit is captured as an append-only revision snapshot
  with a one-line change summary.
- **Compare & merge** two MIGs, and recover soft-deleted MIGs from the trash.
- **Validate** constraint expressions (a small formal rule language over element
  paths) and validate sample message instances.
- **Import / export** — import MIGs from YAML; export as YAML (the canonical,
  diff-stable, re-importable form) or as Markdown / CSV (export-only).

## Usage

Open [https://payment-buddy.github.io/iso20022-mig-editor/](https://payment-buddy.github.io/iso20022-mig-editor/) directly in your browser — no installation needed.

or

Download the latest self-contained HTML file from the [Releases page](https://github.com/payment-buddy/iso20022-mig-editor/releases) and open it in your browser.
No server or internet connection required.

## Development

### Build from source

```bash
npm install
npm run build
```
The build output is a single self-contained HTML file (via `vite-plugin-singlefile`).

## Scripts

| Command             | Description                             |
|---------------------|-----------------------------------------|
| `npm run dev`       | Vite dev server                         |
| `npm run build`     | Typecheck and bundle (single-file HTML) |
| `npm run preview`   | Preview the production build            |
| `npm test`          | Run the test suite once (Vitest)        |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm run lint`      | ESLint                                  |
| `npm run format`    | Prettier                                |

Run a single test file with `npx vitest path/to/file.test.ts`.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui (Radix) · Phosphor
icons · IndexedDB · Vitest. There is no global test config: tests run on Vitest's
default `node` environment, and component tests opt into jsdom (and IndexedDB
tests into `fake-indexeddb`) per file.

## Architecture

The codebase is layered, with a hard rule that `core/` is pure TypeScript with no
React so the domain logic stays unit-testable in isolation.

- **`src/core/`** — the data model (`types/`), e-Repository parsing
  (`erepository/`), all MIG logic (`mig/` — merge, diff, validate, YAML
  serialization, revisions, and Markdown/CSV export), the
  constraint-expression DSL (`mig/expression/`), and IndexedDB persistence
  (`storage/`).
- **`src/app/`** — the hash-based router, app shell, and load/recovery gating.
- **`src/features/`** — UI for the repository browser and the MIG editor.
- **`src/components/`** — shadcn/ui components.

See [CLAUDE.md](./CLAUDE.md) for a deeper tour of the model invariants (MIG
identity, tri-state overrides, parent-chain inheritance, the serialization
contract) before making changes.

## License

Released into the public domain under the [Unlicense](./LICENSE.txt) — free to
copy, modify, use, and distribute for any purpose.
