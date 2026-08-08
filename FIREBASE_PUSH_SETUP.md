# Firebase Push — Apps Script activation

This project uses Firebase Cloud Messaging HTTP v1 to send Android notifications directly from the Natsha Family admin panel.

## Current Firebase values
- Firebase project: `natsha-family-app`
- Topic: `natsha_family_all`
- Android notification channel: `family_updates`
- Android package: `com.alnatshah.sadaqah`

## 1. Add the add-on file
Copy `FirebasePushAddon.gs` into the same Google Apps Script project that contains `FamilyNotificationsBackend.gs`.

## 2. Add one router case
Inside the existing `doPost(e)` switch, add:

```js
case 'sendPushNotification': return json_(sendPushNotification_(body));
```

Place it beside the other authenticated admin actions such as `publishAnnouncement`.

## 3. Add Firebase Messaging OAuth scope
In Apps Script Project Settings, enable **Show appsscript.json manifest file in editor**.

Merge these scopes into the manifest's `oauthScopes` array (do not remove scopes already required by the project):

```json
[
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/script.external_request",
  "https://www.googleapis.com/auth/script.scriptapp",
  "https://www.googleapis.com/auth/firebase.messaging"
]
```

The FCM HTTP v1 send API requires the `firebase.messaging` OAuth scope. The implementation uses `ScriptApp.getOAuthToken()` server-side; no Firebase secret is placed in GitHub or the browser.

## 4. Authorize once
From the Apps Script editor run:

```text
authorizeFirebasePush
```

Approve the requested permissions using the Google account that has access to Firebase project `natsha-family-app`.

Then run:

```text
testFirebasePush
```

A test notification should arrive on devices subscribed to `natsha_family_all`.

## 5. Redeploy the existing Web App
Because code changed, update the existing Web App deployment to a new version while keeping the same Web App URL.

## 6. Activate the website button
After the deployed backend test succeeds, set `pushEnabled: true` in `notifications-config.js`.

## Security
- Do not put Firebase service-account private keys or OAuth access tokens in GitHub.
- Do not put any server credential in `family-admin.html`.
- Sending remains protected by the existing admin session and requires role `owner` or `admin`.
