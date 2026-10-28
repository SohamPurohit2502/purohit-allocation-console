# Independent portfolio connection

Production API: https://purohit-portfolio-api.pages.dev/api/portfolio
Entry point: backend/worker.mjs
Cloudflare Pages project: purohit-portfolio-api (nodejs_compat).

No datasheet worker, KV binding, OAuth token, or AI key is used. Old browser endpoint overrides are ignored.

Activation requires secrets configured on this project only:
- STAFF_ACCESS_CODE: a new portfolio-specific access code.
- AI provider credentials: pending owner selection. Currently supported GEMINI_API_KEY / GEMINI_MODEL and GROQ_API_KEY / GROQ_MODEL. Claude requires an adapter before activation.
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET: a dedicated Google OAuth client.
- GOOGLE_REFRESH_TOKEN: obtained through consent from support@purohitassociates.org for the dedicated OAuth client. Never copy the datasheet refresh token.

Keep all secrets in Cloudflare; never put them in this repository or the public website. Redeploy after configuration changes. Without setup the service returns 503 and local drafts/exports remain usable.

Existing Drive files are not deleted. With a new OAuth client, drive.file access does not automatically include files created by the old app: re-authorize access to the existing portfolio folder or import the user's local saved plans and sync them through the new connection. Do not silently broaden Drive permissions.

Validation: tests/backend.test.mjs checks independent authentication and verifies the Google account against Drive's about endpoint before reading or writing plans. No production provider key or Drive consent is configured yet.
