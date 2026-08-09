# Meta / WhatsApp Status — 2026-08-09

This file is a continuation handover for the Natsha Family project. It contains no tokens or secrets.

## Correct production identifiers
- Meta app: `natsheh.fam`
- Real WABA ID: `1509166401238777`
- Real sender: `+962797944820`
- Real Phone Number ID: `1247066438492618`
- Test recipient used: `+962795509395`
- Approved/active subscription template: `natsha_family_subscription_v2`

## Apps Script state
- `WHATSAPP_BUSINESS_ACCOUNT_ID` was corrected from the test WABA to the real WABA: `1509166401238777`.
- `WHATSAPP_ACCESS_TOKEN` remains stored only in Script Properties; do not expose or commit it.
- `testWhatsAppBusinessManagementPermission()` was executed and returned HTTP 200 with the real account name `عائلة النتشة`.
- `testNatshaSubscriptionTemplate()` was executed successfully and the template reached the owned test number with Quick Reply buttons `تم` / `انسحب`.
- The webhook code handles incoming `تم` as subscribe and `انسحب` as unsubscribe.
- Delivery/status logging for `sent / delivered / read / failed` was added to the webhook backend and the Apps Script Web App deployment was updated.

## Meta setup completed
- Webhooks configured.
- Webhook field `messages` is subscribed.
- Real WhatsApp phone number registered.
- Billing/payment method setup completed.
- Meta's built-in send-message setup step completed and is green.
- App basic settings completed:
  - Privacy: `https://gazynn-sketch.github.io/ghazi-alnatshah.github.io/privacy.html`
  - Data deletion instructions: same privacy URL
  - Terms: `https://gazynn-sketch.github.io/ghazi-alnatshah.github.io/terms.html`
  - Category: Lifestyle / نمط حياة
- Meta Required Actions currently shows no pending actions.

## Graph API Explorer test
- API version: `v26.0`
- Permissions selected: `whatsapp_business_management`, `whatsapp_business_messaging`
- GET request executed successfully:
  - `1509166401238777?fields=id,name`
- Response returned the real WABA.

## Current blocker
- Meta app is still shown as `غير منشور` / unpublished.
- Use-case test page shows `whatsapp_business_messaging` count = 1.
- `whatsapp_business_management` count still shows 0 even though both Apps Script and Graph API Explorer requests succeeded.
- Meta's page states test-usage data can take up to 24 hours to appear.
- A real `تم` click/reply was tested, but the latest Google Sheet check did not yet show a new inbound record. Re-test after the app is published.

## Next step
1. Refresh Meta's Use Case Test page after some time and check whether `whatsapp_business_management` changes from 0.
2. Open Meta's `نشر` page and publish the app when the use-case test is recognized.
3. After publication, send `natsha_family_subscription_v2` to one owned test number.
4. Press `تم` and verify in Google Sheet that WhatsApp consent becomes TRUE, status becomes `نشط`, and a new inbound record is logged.
5. Test `انسحب` once and verify status becomes `ملغي`.
6. Only then start the family broadcast.

## Safety
- Never paste Access Tokens, secrets, verification codes, or keystore passwords into chat.
- Never commit secrets to GitHub.
