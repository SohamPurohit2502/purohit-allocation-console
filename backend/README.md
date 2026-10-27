# Office backend extension

This is a prepared extension for the existing `purohit-datasheets` Cloudflare Pages project. It is not included in the public GitHub Pages bundle. Deployed 27 October 2026 as Cloudflare deployment `4ae2c11e-d712-4405-8020-de3a59410170`. Production preflight returned 204 and unauthorized POST returned 401. Authenticated Drive and AI calls still require the office code for end-to-end verification.

1. Copy `portfolio-api.mjs` beside that project's `server/worker.mjs` and `server/legacy-worker.mjs`.
2. Add `import {portfolioAPI} from './portfolio-api.mjs';` to `server/worker.mjs`.
3. At the top of the fetch handler, route `/.netlify/functions/portfolio` to `portfolioAPI(request, env)` before the existing routes. Preserve all other handlers.
4. Build and deploy the datasheet project with its existing configuration. Existing STAFF_ACCESS_CODE, OFFICE_CONFIG, Google credentials, GEMINI_API_KEY, GROQ_API_KEY and API_LIMIT are reused, never copied to this repository or the browser.
5. In the allocation console, Data → Connections → enter the existing office code and connect. Verify the server reports support@purohitassociates.org. New JSON + Excel versions go into the separate Purohit Portfolio Plans folder. No datasheet records are edited.

The only cross-origin caller allowed is the exact GitHub Pages origin plus the datasheet origins. Staff authentication is still required. The provider fallback does not retry content-policy refusals. Live market facts are not sourced by this endpoint. No secrets should ever be committed.

Google Drive versioned files preserve saved history. JSON is written only after Excel succeeds. A failed JSON save may leave a harmless orphan Excel file; retry does not overwrite a final version. Drive is not a transactional database; use one editor for a plan at a time.
