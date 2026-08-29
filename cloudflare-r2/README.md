# Natsha Family secure R2 media

Private R2 storage for business-ad images and videos. The bucket is never exposed directly. A Worker validates the existing Apps Script session before upload and serves only unguessable object paths.

## Deploy

```bash
npx wrangler whoami
npx wrangler r2 bucket create natsha-family-media
npx wrangler r2 bucket create natsha-family-media-preview
npx wrangler deploy --config wrangler.jsonc
```

After deployment:

1. Copy the returned Worker origin, without a trailing slash.
2. Add that origin as the Apps Script property `BUSINESS_ADS_R2_PUBLIC_BASE_URL`.
3. Sync the updated `BusinessAdsBackend.gs` into the existing Apps Script project and publish a new Web App version without changing its `/exec` URL.
4. Put the same Worker origin in `r2MediaApiUrl` in `notifications-config.js`.
5. Set `r2MediaEnabled` to `true` only after the live health and upload-authorization checks pass.

Keep `r2MediaEnabled: false` during deployment. With that switch off, the existing Google Drive media path remains active and the production website is not interrupted.

## Security properties

- No R2 access keys or permanent upload secrets exist in browser code or GitHub.
- Uploads require a currently valid business or administrator session.
- CORS accepts only the production GitHub Pages origin.
- File extension, MIME type, size, and binary signature are validated.
- Object names are UUIDs; bucket listing is unavailable.
- The Worker supports byte ranges for reliable video playback.
- Existing Google Drive media remains readable during migration.
