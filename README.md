# ISO 20022 Message Implementation Guide Editor

A browser-only offline tool for exploring ISO 20022 financial message definitions and authoring Message Implementation Guides (MIG).

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

### Creating a new MIG

1. Click **Browse e-Repository** and select a message definition.
2. Click the **Create MIG** button to start authoring a Message Implementation Guide for that message.
3. Edit element cardinality, validation constraints, etc.
4. Download the MIG as YAML when finished.


## Development

### Build from source

```bash
npm install
npm run build
```
The build output is a single self-contained HTML file (via `vite-plugin-singlefile`).

### Commands

| Command           | Description                         |
|-------------------|-------------------------------------|
| `npm run dev`     | Start Vite dev server               |
| `npm run build`   | Type-check and build for production |
| `npm run test`    | Run Vitest tests                    |
| `npm run lint`    | Run ESLint                          |
| `npm run preview` | Preview production build            |

## License

Public domain — see [LICENSE.txt](LICENSE.txt).
