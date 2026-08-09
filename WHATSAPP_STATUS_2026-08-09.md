# WhatsApp current status — 2026-08-09

## Confirmed working
- Real WABA ID: `1509166401238777`.
- Real sender Phone Number ID: `1247066438492618`.
- `subscribeWhatsAppWaba` returned HTTP 200 with `{ "success": true }` after the WABA ID correction.
- Approved subscription template: `natsha_family_subscription_v2`.
- Historical inbound webhook processing is confirmed: test number `962795509395` produced both subscribe (`تم`) and unsubscribe (`انسحب`) events on 2026-08-07.

## Current blocker
- The latest Google Sheet send log shows **120** `SUBSCRIPTION_INVITE` attempts failed on 2026-08-09 with Meta response:
  - HTTP 400
  - `OAuthException`
  - `API access blocked.`
- No successful subscription-invite send was recorded in those batches.
- The newest press of `تم` on test number `962795509395` has not produced a new inbound webhook record yet; the subscriber row still shows the last update from 2026-08-07 19:21:57 and status `ملغي`.

## Do not do yet
- Do **not** restart the bulk subscription broadcast while Meta still returns `API access blocked`.
- Do not rotate or expose the Access Token unless Meta specifically indicates a token problem.

## Next safe step
1. Finish/confirm publishing the Meta app `natsheh.fam` and clear the Meta-side API access block.
2. Send exactly one test template to `WHATSAPP_TEST_RECIPIENT`.
3. Press `تم` and confirm a new `WhatsApp Inbound` row appears in `سجل الإرسال` and the subscriber becomes `نشط` with WhatsApp consent `TRUE`.
4. Test `انسحب` once and confirm the reverse update.
5. Only after both directions work, restart the resumable broadcast.

No Access Token or secret value is stored in this file.
