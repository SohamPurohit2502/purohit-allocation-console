# Independent portfolio connection

Production API: https://purohit-portfolio-api.pages.dev/api/portfolio
Entry point: backend/worker.mjs
Cloudflare Pages project: purohit-portfolio-api (nodejs_compat).

No datasheet worker, KV binding, OAuth token, or AI key is used. Old browser endpoint overrides are ignored.

Activation requires secrets configured on this project only:
- STAFF_ACCESS_CODE: a new portfolio-specific access code.
- AI provider credentials: pending owner selection. Currently supported GEMINI_API_KEY / GEMINI_MODEL and GROQ_API_KEY / GROQ_MODEL. Claude requires an adapter before activation.
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET: a dedicated Google OAuth client.
- PORTFOLIO_STORE and DRIVE_TOKEN_KEY: independent KV namespace and encryption key for the refresh token obtained through the dedicated Google consent flow. Never copy the datasheet refresh token.

Keep all secrets in Cloudflare; never put them in this repository or the public website. Redeploy after configuration changes. Without setup the service returns 503 and local drafts/exports remain usable.

Existing Drive files are not deleted. With a new OAuth client, drive.file access does not automatically include files created by the old app: re-authorize access to the existing portfolio folder or import the user's local saved plans and sync them through the new connection. Do not silently broaden Drive permissions.

Validation: tests/backend.test.mjs checks independent authentication and verifies the Google account against Drive's about endpoint before reading or writing plans. Dedicated Drive consent is configured and verified for support@purohitassociates.org. AI provider keys remain unconfigured.

## Selected AI connection
Gemini with Google Search is tried first. Groq receives Tavily search results if Gemini fails. Sources are returned to the chat. No built-in Groq Compound models are used (retired). Gemini's previously failing 2.5 fallback is removed; GEMINI_FALLBACK_MODEL is optional and must be a model enabled on this project's key.

In Cloudflare > Workers & Pages > purohit-portfolio-api > Settings > Variables and Secrets, add these as encrypted production secrets:
- GEMINI_API_KEY: separate Google AI project key with working quota.
- GROQ_API_KEY: separate Groq key.
- TAVILY_API_KEY: independent search used by the Groq fallback.
- STAFF_ACCESS_CODE: new portfolio access code.
Redeploy after adding secrets. Do not paste keys into chat or source files. Account quota/billing is independent of code deployment and must be available before live testing.

The search fallback sends the current question (up to 400 characters), not the automatically included portfolio context or chat history, to Tavily. Questions should not contain client identifiers. AI still receives context only when explicitly enabled in the chat.

## Dedicated Drive sign-in (November 2026)

Google Cloud project: Purohit Portfolio (`white-device-514219-v5`).
OAuth client: Allocation Console Drive. Only callback: https://purohit-portfolio-api.pages.dev/oauth/callback.
Drive API enabled. Allowed test account: support@purohitassociates.org.
The client requests only drive.file. Google account consent is required before real Drive saving works.

POST connect (office-authenticated) produces a five-minute launch ticket. The server initiates consent with browser-bound state, PKCE and a ten-minute callback deadline. The callback checks the Drive account before saving a refresh token encrypted with AES-GCM in the independent PORTFOLIO_STORE namespace. DRIVE_TOKEN_KEY is server-only. Do not rotate it once tokens exist without a deliberate reconnect plan.

All console files are scoped to a new `Purohit Allocation Console` folder, appProperties role `allocation-console-root-v1`. No datasheet folder or credentials are read. Plan JSON and Excel exports remain versioned. Workspace snapshots include the full saved browser database (masters, portfolios, legacy records and drafts). Snapshots are immutable and content-deduplicated. Restore only accepts files found inside this folder and first saves the current browser workspace as a recovery backup. Unsaved table edits must first be saved as drafts.

Google app is currently in Testing; Google may expire its refresh token after seven days. Production publishing/branding must be completed for durable office use. The UI provides Connect Google Drive and Check connection, plus explicit full-workspace backup/restore controls. Automatic backups run five seconds after saved data changes while connected; failed/offline backup remains explicitly pending.

When updating Cloudflare Pages secrets, do not submit redacted empty values returned by GET as replacements. Use the secret-specific management command or intentionally supply only the targeted settings with documented preservation semantics. Never regenerate DRIVE_TOKEN_KEY when encrypted records exist.

Production verification on 14 November 2026: independent Google refresh/owner check returned HTTP 200; authenticated diagnostic created, read back, and trashed its own temporary file in folder 1KtJGfEOLqrffIHa8XFXCAmh6wyl3oQ2K. Full-workspace uploads use browser gzip compression, server-side opaque versioned storage, and bounded client-side decompression during restore. The initial uncompressed full backup timed out; compressed production verification remains pending.
