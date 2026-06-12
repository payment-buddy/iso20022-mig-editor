# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-only, offline-first PWA for exploring ISO 20022 financial message
definitions (the "e-Repository") and authoring **Message Implementation Guides
(MIGs)** — versioned overlays that constrain a standard message for a specific
use. No backend: everything parses, persists, and runs in the browser.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build  (production typecheck + bundle)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm run format     # prettier --write
npm test           # vitest --run (single pass, CI-style)

npx vitest path/to/file.test.ts          # run one test file (watch)
npx vitest --run path/to/file.test.ts    # run one test file (single pass)
npx vitest -t "name of test"             # run tests matching a name
```

Tests are colocated next to source as `*.test.ts(x)`. There is **no global test
config** (no `test` block in `vite.config.ts`, no `vitest.config`, no
`setupFiles`) — Vitest's default `node` environment is used unless a file opts
in. So per file, as needed: component tests start with `// @vitest-environment
jsdom` plus `import "@testing-library/jest-dom/vitest"`, and IndexedDB tests add
`import "fake-indexeddb/auto"`.

## Architecture

Layered, with a hard rule: **`core/` is pure TypeScript with no React**. UI lives
in `features/`, `app/`, and `components/`. Path alias `@/` → `src/`.

- **`core/types/types.ts`** — the single data model. Read this first. Defines the
  e-Repository shape (`ERepository` → `BusinessArea` → `MessageDefinition` →
  `MessageElement` tree) and the MIG overlay (`MessageImplementationGuide`,
  `ElementOverride`, `ConstraintOverride`).
- **`core/erepository/`** — parses the uploaded `.iso20022` repository (a zip of
  XMI) via a streaming SAX parser (`eRepository.ts`), and resolves a message's
  element tree (`resolveMessage.ts`, `elementPath.ts`).
- **`core/mig/`** — all MIG logic: merging, diffing, validation, YAML
  serialization, revisions, and report export. **Only YAML round-trips** (export
  via `serializeMig.ts`, import-validation via `validateMigImport.ts`);
  `migMarkdown.ts` and `migCsv.ts` are **export-only** reports. The heart of the app.
- **`core/mig/expression/`** — a small lexer→parser→evaluator for the formal
  constraint-expression language (custom DSL on element paths). Used for advisory
  validation of constraint rules; never blocks editing.
- **`core/storage/`** — IndexedDB persistence. `db.ts` is a dependency-free raw
  wrapper around one database (`iso20022`) with four object stores: `eRepository`
  (single record), `mig`, `revision`, `trash`. Each `*Store.ts` wraps one store.
- **`app/`** — hash-router (`routes.ts`), shell, route view, recovery screen.
- **`features/repository/`** — repository upload + read-only message explorer.
- **`features/mig/`** — the MIG editor and all MIG-related screens.
- **`components/ui/`** — shadcn/ui components (Radix + Tailwind v4, Phosphor icons).

### Key model concepts (get these wrong and everything breaks)

- **MIG identity is `name:version`** — see `core/mig/migKey.ts`. This is the key
  in the `mig` store, in `parentMIG` references, and in routes.

- **Overrides are tri-state.** In `ElementOverride`/`ConstraintOverride`, a field
  that is **absent** means *inherit*, an explicit **`null`** means *remove/clear*,
  and a value means *set*. This distinction must survive every merge,
  serialization, and round-trip. Consequence: merges use **key-presence**
  (`{ ...base, ...layer }`), **never `??`** — `??` would treat an intentional
  `null` as absent. See the long comment atop `core/mig/effectiveMig.ts`.

- **MIGs inherit via a `parentMIG` chain.** The *effective* overlay is the chain
  merged ancestor→leaf (leaf wins per field; composites like annotations and
  `additionalConstraints` accumulate). `effectiveMig()` flattens it; this is a
  computed view for diffing/reporting and is **not** stored.

- **`elementOverrides` is keyed by `xmlPath`** (slash-joined element path into the
  message tree), not by element id.

- **Serialization is a stable contract.** `serializeMig.ts` emits canonical YAML
  in schema/document order so diffs stay stable; `null` is preserved, empty
  collections dropped. Don't casually change the ordering or key emission — read
  the contract comment at the top of the file (and `migConstants.ts` for the
  property orders).

- **Revisions are append-only full snapshots.** Each carries a one-line
  `summary` computed once against the previous revision (`core/mig/revisions.ts`);
  the editor debounces snapshotting.

### Routing & app gating

Routing is a dependency-free typed hash-router: the URL hash is the single source
of truth (`app/routes.ts` `parseHash`/`hashFor`/`navigate`). `App.tsx` gates the
whole app on a state machine — load repo → `upload` / `ready` / `updating` /
`error` (recovery screen when IndexedDB can't be opened).

## Conventions

- Prettier: no semicolons, double quotes, 2-space, width 80, `es5` trailing
  commas. `cn`/`cva` are registered as Tailwind functions for class sorting.
- TS is strict with `noUnusedLocals`/`noUnusedParameters` and
  `verbatimModuleSyntax` (use `import type` for type-only imports).
- Add shadcn components with `npx shadcn@latest add <name>` (config in
  `components.json`; style `radix-mira`, base color neutral, Phosphor icons).
- Keep `core/` free of React/DOM imports so logic stays unit-testable in isolation.

## Git workflow

- **Only commit when explicitly asked** — never commit unprompted, even after
  finishing a change.
- **Commit directly to `master`** — do *not* create a feature branch first. This
  overrides any default "branch before committing on the default branch" behavior.

## Build & offline

`vite build` produces a **single self-contained HTML file** (`vite-plugin-singlefile`)
— the app must work fully offline. PWA sidecars (`public/manifest.json`,
`public/sw.js`, `icon.svg`) are static, not bundled; `src/app/pwa.test.ts` guards
that they stay valid, self-contained, and relative (no external URLs that would
fail offline). The service worker is registered inline in `index.html`.