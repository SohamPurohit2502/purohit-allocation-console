# Purohit Associates LLP Allocation Console

Internal mutual fund allocation workspace, published on GitHub Pages. The live browser edition stores client masters, portfolio snapshots, drafts and final allocations in IndexedDB on the current browser/device. GitHub receives application code and public scheme data only, not uploaded client reports or browser records. Clearing site storage removes these local records; they are not synchronised across devices.

## Build the GitHub Pages edition

Use Node 22.13+ and pnpm install. Build with `node node_modules/vite/bin/vite.js build --config vite.pages.config.ts --outDir ../work/pages-build`. Copy the resulting work/pages-build contents to dist-pages without deleting its Git repository. The older Vinext/D1 entry points are retained for the previous deployment; the active GitHub Pages edition uses lib/browser-storage.ts.

## Portfolios and folios

Select a client (or create one using New client), then open Existing portfolio. Import a single-client, text-based Wealth Elite valuation PDF or Investwell Portfolio Valuation Summary. PDF.js runs locally with a bundled worker. The parser reads positioned table text, checks the report grand total against the extracted holdings within row-rounding tolerance, and rejects unsupported/incomplete reports. Scans and password-protected files are not supported. Report owners must be reviewed and confirmed before saving. Files and extracted personal data are never committed to GitHub.

Imports replace the client's current snapshot only after review and save. Replaced snapshots are retained locally in portfolioHistory; edits to an existing snapshot preserve originalHoldings. The UI exposes the original imported snapshot. Holdings support manual addition, removal, value/folio edits and scheme-master matching. Ambiguous/renamed schemes remain unmatched and cannot be added to the allocation until mapped. Editing reported units/NAV does not independently recompute a reported market value.

Existing holding values remain separate from the new-investment amount. Add investment stages the matched scheme and folio. Scheme selection reuses the sole existing folio for the selected client and AMC; multiple folios require a choice. Each cart line supports existing, manually entered, or new folio. Folios are strings, preserving leading zeroes and slashes. Selecting another client clears the previous client's folio choices. Drafts, final allocations, print and CSV retain the folio. Changing client IDs migrates their portfolio association; final allocation snapshots stay immutable.

New client supports an optional Iwell ID; otherwise it creates a unique temporary NEW- ID that can be edited later. Client/scheme bulk imports accept up to 20,000 rows. Allocation amounts are integer paise; finalisation requires exact allocation and valid folio choices. No trade execution is connected. Send to operations has been removed. Printing uses an isolated HTML document with a repeated table header instead of the scrolling dialog.

## Verification

TypeScript and production build checks; both supplied report layouts extracted 36 holdings and reconciled within one paisa. Isolated browser tests covered both PDF imports, the review gate, new clients, edits with original snapshot preservation, replacement without duplication, automatic and manual folios, leading-zero persistence, draft resume, finalisation and history reload. A generated allocation print page was rendered and inspected. Test reports and screenshots live only in ignored work/.

## Portfolio workspace redesign — October 2026

The default screen is now a keyboard-first, single-table portfolio workspace, branded with the supplied white SVG logo and favicon. Existing holdings and planned buys, redemptions, same-AMC switches and SIP instructions share one table. Shift+Up/Down navigates enabled amount inputs. Only the table scrolls; action controls remain visible. Ctrl+K provides a command palette and Alt key hints cover common actions. New clients can start with an empty table. Previous workflows and historical drafts remain reachable through Data → Previous console.

Bulk CSV folio imports are reviewed before an atomic replacement of current snapshots. The reference report has 54,898 holding rows for 4,237 investor identities. Fifteen reused Iwell codes are separated with IWELL CODE2; distinct lots are retained. Three identical source rows require explicit inclusion confirmation and are visibly flagged. Totals reconcile against the report's grand total within one rupee (the report total is rounded). The file is not committed or uploaded to the public site. Portfolio import dates are not misrepresented as valuation dates. Average holding days are presented approximately using 365-day years and 30-day months; reported CAGR is not invented when absent.

Category and AMC previews use the master. Sector preview requires a validated CSV with `Scheme ID,Sector,Weight,As of`; no fabricated sector data is seeded. Missing weights appear as Unmapped. SIP instructions are exported but do not change today's holdings. All calculations use integer paise.

New plans are persisted in the existing IndexedDB database under a separate `deskPlans` field. Finals are immutable, and reopening a final creates a new editable plan. Multi-select exports produce styled XLSX, grouped into one sheet per investor with safe unique sheet names; folios are text. Exports include action, destination scheme, destination folio, SIP date and frequency as well as source holdings. These records are proposed instructions, not transaction executions.

### Office services: prepared, activation pending

`backend/portfolio-api.mjs` extends the existing purohit-datasheets server and reuses its server-side Drive and Gemini/Groq credentials. See backend/README.md. It is NOT yet deployed. The public UI reports connection failures and saves locally; it never claims a successful cloud save without a server response. The office access code is kept only in memory. No API keys or customer data are included in public assets. Drive saves versioned JSON and Excel copies in a separate Purohit Portfolio Plans folder. The AI assistant is read-only, uses optional anonymous portfolio context, does not have live market retrieval, and falls back from Gemini to Groq on service failures.

### Checks

`node --test tests/workspace.test.mjs tests/backend.test.mjs`

Set FOLIO_FIXTURE to a private local report path to additionally reconcile the full reference file. Run `node node_modules/typescript/bin/tsc --noEmit` and `node node_modules/vite/bin/vite.js build --config vite.pages.config.ts`. Preserve old hashed assets in dist-pages to avoid breaking open browser sessions.
