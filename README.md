# LogVibe

**A privacy-first, local CSV & server-log analyzer.** Drop in a file, then
filter, sort, profile, chart, compare, and **scan it for threats** — entirely in
your browser. Your data never leaves the machine.

**🔗 Live demo:** https://jd68686727.github.io/Project-LogVibe/ — load a file or
click a bundled sample; nothing is uploaded.

LogVibe is built for IT administrators, data analysts, and developers who need a
fast, GDPR-friendly way to explore large logs and CSVs — and to sanity-check
them for security issues — without handing them to a third-party service.

## Why local-first

- **Zero-touch data.** 100% of parsing and analysis happens client-side. There is
  no backend, no database, and no upload — the only thing that persists is your
  lightweight view configuration (filter/chart presets) in `localStorage`.
- **GDPR-friendly by construction.** Data that never leaves the browser can't leak
  from a server you forgot to patch. Even sharing is safe: the redaction export
  anonymizes sensitive values on the way out.
- **Zero infrastructure cost.** It's a static site; host it anywhere.

## Features

### Ingest
- **Streaming, encoding-robust ingestion** — drag-and-drop or pick a `.csv` /
  `.tsv` / `.log` / `.txt`. UTF-8 parses in a Web Worker (via PapaParse) so the
  UI stays responsive on large files; UTF-16/Windows-1252 are auto-detected and
  re-decoded. Column headers and types are inferred automatically.
- **Custom log-pattern builder** — map unstructured logs (Nginx, Apache, syslog,
  app logs) into columns with a named-group regex, with a live preview.
- **Live tailing** — follow a growing file (File System Access API, Chromium /
  Edge): appended lines stream in and the view updates live. Works for CSV and
  custom-log formats, with an optional **auto-scan** that surfaces threats as
  they arrive and **desktop alerts** on new high-severity findings. A keep-last-N
  ring buffer bounds memory on long-running tails.
- **Network-artifact adapters** — `arp -a` tables and TShark/Wireshark text
  dumps are auto-detected and parsed into columns.
- **One-click samples** — try bundled demo files straight from the empty state.

### Explore
- **Virtualized table** — only visible rows are mounted, so 50k+ row files scroll
  smoothly. Click-to-sort headers, **multi-column sort** (Shift-click), column
  show/hide/reorder, per-column **type override**, and a **row-detail** drawer.
- **Type-aware filtering** — per-column operators (`contains`, `=`, `>`,
  `between`, `is empty`, …) in **OR filter groups** (AND within a group, OR
  between). Plus a **global search** with a **regex mode** and a one-click
  **quick-pattern library** (IPv4/IPv6/MAC/e-mail/UUID/HTTP-errors) that can
  filter or extract distinct matches.
- **Column statistics & distributions** — a collapsible profile (non-null / null
  / distinct, min / mean / max) with per-column histograms and top-values you can
  click to drill into a filter.
- **Computed columns** — derive a new column from a formula: regex-extract a
  field out of a raw message, do arithmetic between columns/constants, or stitch
  fields into a text template. The result is a first-class column (filter / sort /
  chart / pivot / export all work on it) that keeps computing while tailing, is
  remembered across reloads, and travels in saved views and share links.

### Visualize
- **Charts** — bar / line / pie over the filtered set; group-by + count / sum /
  avg / min / max, with hour/day/week/month **date bucketing**.
- **Pivot table** — cross-tab two columns with numeric range bucketing and
  click-to-drill cells.
- **Timezone toggle** — view all dates and chart buckets in UTC (default), your
  local zone, or any IANA zone. Display-only; raw data is untouched.

### Export & share
- **Export CSV / JSON / Excel** of the filtered + sorted view.
- **Redaction** — opt-in, vendor-safe anonymization of IPs / MACs / e-mails on
  export (consistent dummies like `[IP_1]`, or a fixed `[REDACTED]` token).
- **Saved views**, **shareable links**, and **last-view restore** — all persist
  configuration only, never row data.

### Compare
- **Multi-file compare** — overlay aggregated trends across files as multi-series
  charts, each file with its own filter subset.
- **Schema & row diff** — added/removed/type-changed columns and changed rows.
- **Time-sync** — a per-file time offset to align two logs with a clock skew onto
  one bucketed time axis.

### Security (defensive)
- **Threat scan** — one-click detectors over the current view: brute-force
  logins, HTTP error scanning, path enumeration, off-hours activity, injection
  payloads (SQLi / XSS / path-traversal / command-injection / SSRF / Log4Shell),
  and scanner-tool fingerprints (sqlmap / nikto / nmap …). Findings are ranked by
  a **risk score** (severity × volume) and tagged with a **MITRE ATT&CK**
  technique; the scan runs off the main thread and opens as a first-class dataset.
- **Config audit** — check SSH, Apache, nginx, Cisco IOS, Docker Compose, and
  firewall (iptables / ufw) configs against built-in hardening rules (root login,
  weak TLS, telnet, default SNMP, privileged containers, allow-by-default
  firewall policy, …).
- **Security report** — export findings as a shareable Markdown report, with
  optional address redaction.

### Configure
- **Bilingual UI (English / German)** with locale-aware number formatting,
  switchable in the settings and remembered per browser.
- **Settings panel** — defaults for theme, display timezone, live-tail alerts,
  and the live-tail buffer size, plus a one-click **"clear everything this
  browser remembers"** (GDPR-friendly local-data management).

Dark mode, responsive layout, and error boundaries throughout.

## Tech stack

React 18 · TypeScript (strict) · Vite · Tailwind CSS · PapaParse ·
TanStack Virtual · Recharts · SheetJS (lazy-loaded for Excel) · native `Intl`.
No backend, no analytics.

## Getting started

Requires Node 20+.

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check and produce a production build in dist/
npm run preview  # preview the production build
```

Or just open the [live demo](https://jd68686727.github.io/Project-LogVibe/) and
click a sample. More sample files live in [`samples/`](samples/).

## Architecture

The core idea is a **zero-copy index pipeline**. Rows are parsed once into flat
arrays (`CellValue[]`, lighter and faster than keyed objects at scale) and then
every stage operates on arrays of **row indices** rather than copying row data:

```
ingest ──▶ filter ──▶ sort ──▶ ┬─▶ virtualized table
(rows)    (indices)  (indices) ├─▶ charts / pivot (aggregate)
                               ├─▶ column stats
                               └─▶ security scan (findings)
```

Filtering narrows an index array, sorting permutes it, and the table virtualizer
renders a few dozen of them — so a 50k-row dataset is never duplicated in memory.
The security modules share one currency: every detector/audit rule emits a
`Finding`, and `findingsToDataset` turns findings back into a `Dataset` so they
inherit the whole table / filter / export surface.

Code is organized by **feature slice**, with logic kept separate from UI:

- `src/features/*` — domain slices (`ingestion`, `table`, `filtering`,
  `visualization`, `stats`, `presets`, `export`, `sharing`, `compare`,
  `workspace`, `time`, `security`, `config`, `analysis`, `settings`); each holds
  its React `hooks/` and Tailwind `components/`.
- `src/lib/i18n/*` — the dependency-free English/German catalog + translation
  context.
- `src/lib/*` — pure, framework-free logic (`csv`, `filter`, `chart`, `stats`,
  `compare`, `storage`, `time`, `security`, `config`, `analysis`, `ingest`); this
  is where the correctness-critical code and unit tests are focused.
- `src/types/*` — shared domain contracts.
- `src/app/*` — composition root (`App`, `DataWorkspace` orchestrator).

Recharts, the compare view, and SheetJS are code-split (lazy-loaded), so the
initial drop-zone bundle stays small.

## Testing

Two layers, both run in CI on every push and PR:

```bash
npm test          # Vitest unit suite (pure logic), run once
npm run test:watch
npm run e2e        # Playwright tests (real browser flows)
```

- **Unit** — `src/**/*.test.ts(x)` exercise schema inference, filtering,
  aggregation, date bucketing + timezones, column stats, comparison + time-sync,
  export + redaction, the security detectors, config audit, and reporting.
- **E2E** — `e2e/*.spec.ts` drive Chromium through the core journeys (ingest →
  filter → chart, computed columns, compare, security scan, config audit,
  redaction, timezone, live tailing, settings, and the bilingual UI).
  Playwright boots the dev server itself.

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
| `npm run e2e` | Run the Playwright E2E tests |

## License

Proprietary — all rights reserved.
