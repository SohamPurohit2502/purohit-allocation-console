# Purohit Associates LLP Allocation Console

Responsive mutual fund allocation workspace. The supplied logo is used as an unchanged image.

## Run

Use Node 22.13+ (x64 on Windows ARM because workerd requires x64), then `pnpm install` and `pnpm dev`. Build with `pnpm build`. The app uses Vinext/React and Cloudflare D1 via Sites. Database schema is in db/schema.ts; migrations are in drizzle/.

## Data and operation

The scheme catalogue contains 1,823 records from Top Schemes-14-09-2026-05_38_28.xlsx. Exact supplied scheme names and source categories are retained; category display labels are normalised. No performance metrics are imported. Sample clients and baskets seed the database once. Former sample schemes are inactive and matching basket/favourite/recent references are remapped to the supplied catalogue. Imports accept CSV or the first sheet of XLSX, add new unique IDs and reject an entire batch if it contains invalid or existing IDs. Required headers are available in the downloadable templates.

Allocation amounts are integer paise. Equal splits and baskets distribute rounding remainders exactly. Finalisation requires a selected client, positive investment, unique active schemes, positive amounts, and an exact total. Finalised records snapshot the complete scheme names and cannot be overwritten. Drafts, history, imports, favourites, recents, baskets and the operations queue persist in D1. Sites owner-private access protects the deployed workspace. Browser storage is not used as the authoritative database.

Send to operations queues a record internally in History. No external email, messaging, trade execution or investment transaction is connected. CSV export uses full scheme names and escapes spreadsheet formula prefixes.

## Verification

Production build and TypeScript check. Focused local tests cover Indian currency formatting, partial-name search, rounding, duplicate rejection, draft saving/deletion, exact finalisation validation, immutable final records, operations queue and unique client imports. No browser UI testing was requested. WebMCP staging and read tools are feature-detected; a supported WebMCP validation context was unavailable, so those tools have not been runtime-verified.

