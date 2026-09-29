# Cloudflare private family registry

Prepared service, **not deployed or connected to production yet**. Keep `family-registry/config.js` empty until live verification passes.

## Architecture

A separate Worker `natsha-family-registry` with three D1 bindings: `AUTH_DB`, `QUDS_DB`, `JORDAN_DB`. Existing R2 media Worker and bucket are unchanged. The two family registries are physically separate databases. Each account is authorized for an explicit set of regions. API callers must specify `?region=quds` or `?region=jordan`; the server checks the account scope.

Passwords use salted PBKDF2-SHA256 with 100,000 iterations and account/IP rate limits. There is no default account or inherited password. Bearer sessions expire after 2 hours, are kept only in page memory, and only token digests enter D1. Disabling accounts or logout invalidates sessions. Viewers do not receive telephone, email, notes, dues, or archived records. All responses are no-store. Mutation validation and optimistic snapshot revision checks prevent lost updates and concurrent ancestry corruption. The current per-region JSON snapshot limit is 900 KB; beyond that migrate to normalized member tables before expanding.

## Deployment after Cloudflare account access

Install official Wrangler and authenticate through its normal login flow. Do not paste tokens or passwords into chat or commit them.

1. Create databases with `npx wrangler d1 create natsha-family-auth`, `natsha-family-quds`, and `natsha-family-jordan`. Copy the **returned** IDs into this directory's `wrangler.jsonc`.
2. Apply `schema-auth.sql` to auth and `schema-region.sql` to each regional database using `npx wrangler d1 execute DATABASE --remote --file=PATH --config=cloudflare-family/wrangler.jsonc`.
3. Generate private regional imports: `node cloudflare-family/prepare-import.mjs PRIVATE_JSON PRIVATE_DIRECTORY`. Apply each resulting `*-initial.sql` only to its corresponding empty regional database. Imports use short statements to stay under SQL statement limits. They fail instead of overwriting an existing registry.
4. In a private terminal, run `node cloudflare-family/bootstrap-admin.mjs PRIVATE_DIRECTORY/bootstrap-admin.sql`. The script prompts for a new name, username and hidden password, saves only a salted hash in a private SQL file, and grants the first administrator access to both regions. The account owner must complete this step. Apply the SQL to AUTH_DB.
5. `npx wrangler deploy --config cloudflare-family/wrangler.jsonc`. Record the actual returned Worker origin.
6. Verify `/api/health`, unauthenticated `/api/data?region=quds` returns 401, login, authorized access to both regions, scope denial, viewer redaction, saving and logout. Do not test production saves against actual family records; use a dedicated test record and archive it afterward.
7. Only after verification set `API_BASE` in `family-registry/config.js` to that verified HTTPS Worker origin and publish the frontend changes. Recheck the actual GitHub Pages origin and Android WebView.

Initial private data and bootstrap SQL must stay outside this public repository. Keep the original verified export as the migration backup. New users created in the UI are scoped to the currently selected region; the initial administrator has both regions. Show this scope to the administrator before account creation.

## Validation

`node --test tests/cloudflare-family.test.mjs tests/registry.test.mjs`

Tests use real in-memory SQLite behind a D1-compatible adapter: login/session expiry rules, region authorization, viewer redaction, read-only users, save and stale-version handling, logout/disable, origin checks, rate limits, account scope escalation, import integrity, Arabic search and CSV protection. These are local tests; live Cloudflare smoke tests are still required before activation.
