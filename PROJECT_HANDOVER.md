# Natsha Family Project — Master Handover

Last updated: 2026-08-08

## GitHub / Android
- Repository: `gazynn-sketch/ghazi-alnatshah.github.io`
- Default branch: `main`
- Android package: `com.alnatshah.sadaqah`
- Current Android version: `1.2.3` / versionCode `6`
- Important files: `FamilyNotificationsBackend.gs`, `FamilyListImport.gs`, `android-app/*`, `index.html`, `notifications.html`, `join-notifications.html`, `family-admin.html`.

## Google Sheets / Apps Script
- Spreadsheet: **إدارة إشعارات ومناسبات عائلة النتشة**
- Spreadsheet ID: `1eDulzaGE3GRrfky_yq6p8yzxS45SJWl-qz5IgmKZbSE`
- Main sheets: `المشتركون`, `المشرفون`, `الإعلانات`, `سجل الإرسال`, `الإعدادات`.
- Apps Script is the backend for subscriptions, announcements, and WhatsApp webhook handling.
- Script Properties used include:
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_GRAPH_VERSION`
  - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - `WHATSAPP_BUSINESS_ACCOUNT_ID`
  - `WHATSAPP_TEMPLATE_LANGUAGE`
  - `WHATSAPP_TEMPLATE_EVENT`
  - `WHATSAPP_TEMPLATE_DEATH`
  - `WHATSAPP_TEMPLATE_NAME`
- Never store token/secret values in GitHub.

## WhatsApp opt-in / opt-out flow
- Initial invitation is sent to family members.
- Reply `تم` => subscribe / opt in.
- Reply `انسحب` => unsubscribe / opt out.
- `FamilyNotificationsBackend.gs` handles text/button/interactive webhook replies.
- `whatsappCommand_()` maps normalized `تم` to subscribe and `انسحب` to unsubscribe.
- On subscribe: WhatsApp consent becomes true, status becomes `نشط`, timestamps are updated, and confirmation text is sent.
- On unsubscribe: consent becomes false, status becomes `ملغي`, timestamps are updated, and re-subscribe guidance is sent.
- This flow has already been tested successfully on WhatsApp.

## Family send list
- Source file: **قائمة العائلة للإرسال - 298 رقم**.
- After de-duplication, 289 new numbers were added to `المشتركون` with status `بانتظار الموافقة`, WhatsApp consent FALSE, app consent FALSE.
- These records are not active subscribers until explicit consent is received.

## Meta / WhatsApp Cloud API current state
- Meta app: `natsheh.fam`
- Webhook is connected to Apps Script.
- Correct current WABA ID: `1509166401238777`
- Real sender number: `+962797944820`
- Current Phone Number ID: `1247066438492618`
- Number status: registered/active.
- `WHATSAPP_PHONE_NUMBER_ID` in Apps Script was updated to the new Phone Number ID.
- System User: `Natsha fam API`
- System User role: Admin.
- `natsheh.fam` app assigned with full access.
- Correct WhatsApp account assigned with full access.
- A non-expiring System User token was created with permissions:
  - `whatsapp_business_management`
  - `whatsapp_business_messaging`
- The token value itself is intentionally not stored here.
- The token was saved only in Apps Script Script Property `WHATSAPP_ACCESS_TOKEN`.
- `subscribeWhatsAppWaba` was executed after the update and returned HTTP 200 with `{"success":true}`.

## Templates
- Subscription template created on the real WABA as `natsha_family_subscription_v2`.
- Arabic body explains Natsha Family notifications and uses Quick Reply buttons `تم` and `انسحب`.
- Latest known status: pending Meta review.
- Other configured template names:
  - `family_event_notice`
  - `family_death_notice`

## Next WhatsApp step
1. Verify `natsha_family_subscription_v2` is approved.
2. Send the invitation template to one owned test recipient.
3. Verify replying `تم` updates the subscriber row to active/consented and returns the automatic confirmation.
4. Verify replying `انسحب` changes the row to cancelled and returns the automatic opt-out confirmation.
5. Only after successful test, send to eligible `بانتظار الموافقة` recipients under Meta policy/consent rules.
6. Do not use `testWhatsApp` blindly until its destination and payload are verified.

## Firebase / Android notifications
- Firebase project: `natsha-family-app`
- Project number: `873041084949`
- Correct Android package: `com.alnatshah.sadaqah`
- Version 1.2.3 includes Firebase Cloud Messaging.
- `NatshaApplication` subscribes to topic `natsha_family_all`.
- `NatshaMessagingService` posts high-importance Heads-up family notifications through channel `family_updates`.
- Android 13+ notification permission is requested automatically at app startup.
- 2026-08-08: Google Play update 1.2.3 is installed on the Android test device.
- 2026-08-08: End-to-end FCM test succeeded from Firebase Console to topic `natsha_family_all`, using Android Notification Channel `family_updates` with sound enabled. The notification appeared on the Android device and tapping it opened the Natsha Family app/notifications page correctly. Push notifications are confirmed working.

## Google Play
- Signed AAB for 1.2.3 / versionCode 6 was produced using the original upload key.
- 2026-08-08: update became available and was installed on the test Android device.

## Prayer notifications
- Implemented locally via `PrayerScheduleManager`, `PrayerAlarmReceiver`, `AdhanService`.
- High-importance Heads-up at prayer time itself.
- No pre-prayer reminder.
- Separate optional short adhan beginning with `الله أكبر الله أكبر`.

## Android signing
- Alias: `natsha-upload`
- Android Studio previously showed keystore path: `C:\Users\ABD AL MAJEED\OneDrive\Desktop\paswd\paswd`
- Never store keystore passwords or private keys in GitHub.

## Continuity rules
- Continue from current state; do not restart the project from scratch.
- Never ask the user to paste Access Tokens or secrets into chat.
- Never commit secrets to GitHub.
- Updating Script Properties alone does not require redeploying the Web App unless code/deployment itself changes.
- Use this handover file as the first reference in future chats.
