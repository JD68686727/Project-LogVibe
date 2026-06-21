# LogVibe

**A privacy-first, local CSV & server-log analyzer.** Drop in a file, then filter,
sort, profile, chart, and compare it — entirely in your browser. Your data never
leaves the machine.

LogVibe is built for IT administrators, data analysts, and developers who need a
fast, GDPR-friendly way to explore large logs and CSVs without uploading them to
a third-party service.

## Why local-first

- **Zero-touch data.** 100% of parsing and analysis happens client-side. There is
  no backend, no database, and no upload — the only thing that persists is your
  lightweight view configuration (filter/chart presets) in `localStorage`.
- **GDPR-friendly by construction.** Data that never leaves the browser can't leak
  from a server you forgot to patch.
- **Zero infrastructure cost.** It's a static site; host it anywhere.

## Features

- **Streaming ingestion** — drag-and-drop or pick a `.csv` / `.tsv` / `.log` /
  `.txt` file. Parsing runs in a Web Worker (via PapaParse) so the UI stays
  responsive on large files; column headers and types are inferred automatically.
- **Virtualized table** — only the visible rows are mounted, so 50k+ row files
  scroll smoothly. Type-aware, click-to-sort headers.
- **Type-aware filtering** — per-column operators (`contains`, `=`, `>`, `between`,
  `is empty`, …) scoped to each column's inferred type, combined with AND.
- **Charts** — bar / line / pie over the filtered set; group-by + count / sum /
  avg / min / max, with hour/day/week/month bucketing for date columns.
- **Column statistics** — a collapsible data profile (non-null / null / distinct
  counts, min / mean / max) over the current filtered view.
- **Saved views** — name and persist filter + chart presets, scoped to a file's
  schema so they re-apply to any file of the same shape.
- **CSV export** — download the filtered + sorted view as CSV.
- **Multi-file compare** — load several files and overlay their aggregated trends
  (e.g. error counts by hour, today vs. yesterday) as multi-series charts.

## Tech stack

React 18 · TypeScript (strict) · Vite · Tailwind CSS · PapaParse ·
TanStack Virtual · Recharts. No backend.

## Getting started

Requires Node 20+.

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check and produce a production build in dist/
npm run preview  # preview the production build
```

There are sample files in [`samples/`](samples/) to try it out.

## Architecture

The core idea is a **zero-copy index pipeline**. Rows are parsed once into flat
arrays (`CellValue[]`, lighter and faster than keyed objects at scale) and then
every stage operates on arrays of **row indices** rather than copying row data:

```
ingest ──▶ filter ──▶ sort ──▶ ┬─▶ virtualized table
(rows)    (indices)  (indices) ├─▶ charts (aggregate)
                               └─▶ column stats
```

Filtering narrows an index array, sorting permutes it, and the table virtualizer
renders a few dozen of them — so a 50k-row dataset is never duplicated in memory.

Code is organized by **feature slice**, with logic kept separate from UI:

- `src/features/*` — domain slices (`ingestion`, `table`, `filtering`,
  `visualization`, `stats`, `presets`, `export`, `compare`, `workspace`); each
  holds its React `hooks/` (state/logic) and `components/` (Tailwind UI).
- `src/lib/*` — pure, framework-free logic (`csv`, `filter`, `chart`, `stats`,
  `compare`, `storage`); this is where the correctness-critical code lives and
  where the unit tests are focused.
- `src/types/*` — shared domain contracts (`dataset`, `filter`, `chart`, …).
- `src/app/*` — composition root (`App`, `DataWorkspace` orchestrator).

Recharts and the compare view are code-split (lazy-loaded), so the initial
drop-zone bundle stays small.

## Testing

Two layers, both run in CI on every push and PR:

```bash
npm test          # Vitest unit suite (pure logic), run once
npm run test:watch
npm run e2e        # Playwright smoke tests (real browser flows)
```

- **Unit** — `src/**/*.test.ts` exercise schema inference, filtering, aggregation,
  date bucketing, column stats, comparison, and CSV export.
- **E2E** — `e2e/*.spec.ts` drive Chromium through the core journeys (load → filter
  → chart, and multi-file compare). Playwright boots the dev server itself.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm test` | Run the Vitest unit suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run e2e` | Run the Playwright E2E smoke tests |

## License

Proprietary — all rights reserved.
