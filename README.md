# ISO 20022 Message Implementation Guidelines Editor

A browser-only offline tool for exploring ISO 20022 financial message definitions and authoring Message Implementation Guidelines (MIG).

## Features

- Load and browse business areas and message definitions from ISO 20022 e-Repository.
- Inspect the full element tree with type information, cardinality, constraints, and code sets.
- Create and edit MIGs: override element cardinality, validation constraints, and allowed codes per XML path.
- Download individual MIGs or a full backup as YAML; import MIGs from YAML.

## Usage

### Use online

Open [https://payment-buddy.github.io/iso20022-mig-editor/](https://payment-buddy.github.io/iso20022-mig-editor/) directly in your browser — no installation needed.

### Download for offline use

Download the latest self-contained HTML file from the [Releases page](https://github.com/payment-buddy/iso20022-mig-editor/releases) and open it in your browser. No server or internet connection required.

## Development

### Build from source

```bash
npm install
npm run dev
```

### Commands

| Command           | Description                         |
|-------------------|-------------------------------------|
| `npm run dev`     | Start Vite dev server               |
| `npm run build`   | Type-check and build for production |
| `npm run lint`    | Run ESLint                          |
| `npm run preview` | Preview production build            |

The build output is a single self-contained HTML file (via `vite-plugin-singlefile`).

## License

Public domain — see [LICENSE.txt](LICENSE.txt).
