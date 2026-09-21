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
