# ISO 20022 Message Implementation Guidelines Editor

A browser-only offline tool for exploring ISO 20022 financial message definitions and authoring Message Implementation Guidelines (MIG).

## Features

- Load an ISO 20022 e-Repository file (`.iso20022` XML or `.zip`) — parsed and stored in IndexedDB so it persists across sessions
- Browse business areas and message definitions
- Inspect the full element tree with type information, cardinality, constraints, and code sets
- Create and edit MIGs: override element cardinality, validation constraints, and allowed codes per XML path
- Download individual MIGs or a full backup as YAML; import MIGs from YAML

## Getting started

```bash
npm install
npm run dev
```

Open the app, upload an e-Repository file, then start browsing message definitions or create a MIG.

## Commands

| Command           | Description                         |
|-------------------|-------------------------------------|
| `npm run dev`     | Start Vite dev server               |
| `npm run build`   | Type-check and build for production |
| `npm run lint`    | Run ESLint                          |
| `npm run preview` | Preview production build            |

The build output is a single self-contained HTML file (via `vite-plugin-singlefile`).

## License

Public domain — see [LICENSE.txt](LICENSE.txt).
