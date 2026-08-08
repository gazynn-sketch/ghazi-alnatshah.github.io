// Natsha Family — Firebase Cloud Messaging add-on for Google Apps Script
// Add this file to the SAME Apps Script project that contains FamilyNotificationsBackend.gs.
// The main doPost(e) switch must include:
// case 'sendPushNotification': return json_(sendPushNotification_(body));

const FIREBASE_PUSH = Object.freeze({
  projectId: 'natsha-family-app',
  topic: 'natsha_family_all',
  channelId: 'family_updates',
  scope: 'https://www.googleapis.com/auth/firebase.messaging'
});

/**
 * Admin API action. Requires an authenticated owner/admin session.
 * Sends one notification to every Android device subscribed to natsha_family_all.
 */
function sendPushNotification_(body) {
  const admin = requireRole_(body.token, ['owner', 'admin']);
  const title = clean_(body.title, 120);
  const message = clean_(body.message, 1000);
  if (!title || !message) throw new Error('عنوان الإشعار ونصه مطلوبان');

  const result = sendFirebaseTopicMessage_(title, message, admin.email);
  return {
    ok: true,
    topic: FIREBASE_PUSH.topic,
    messageId: result.messageId || ''
  };
}

/**
 * Server-side FCM HTTP v1 sender. No Firebase secret is exposed to the website.
 * Authorization uses the effective Apps Script user's short-lived OAuth token.
 */
function sendFirebaseTopicMessage_(title, message, adminEmail) {
  const url = 'https://fcm.googleapis.com/v1/projects/' + FIREBASE_PUSH.projectId + '/messages:send';
  const payload = {
    message: {
      topic: FIREBASE_PUSH.topic,
      notification: {
        title: clean_(title, 120),
        body: clean_(message, 1000)
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: FIREBASE_PUSH.channelId,
          sound: 'default',
          visibility: 'PUBLIC',
          default_vibrate_timings: true
        }
      },
      data: {
        source: 'family-admin',
        openNotifications: 'true'
      }
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText() || '{}';
  let parsed = {};
  try { parsed = JSON.parse(text); } catch (ignore) {}

  if (code < 200 || code >= 300) {
    const error = 'FCM HTTP ' + code + ': ' + clean_(text, 500);
    try { logSend_('PUSH', 'topic:' + FIREBASE_PUSH.topic, 'Firebase Push', 'فشل', '', error, adminEmail || 'system'); } catch (ignore) {}
    throw new Error(error);
  }

  const providerId = clean_(parsed.name, 300);
  try { logSend_('PUSH', 'topic:' + FIREBASE_PUSH.topic, 'Firebase Push', 'تم', providerId, '', adminEmail || 'system'); } catch (ignore) {}
  return {ok:true, messageId:providerId};
}

/**
 * Run once manually from the Apps Script editor after adding the Firebase OAuth scope.
 * This prompts the project owner to grant the required permissions.
 */
function authorizeFirebasePush() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [FIREBASE_PUSH.scope]);
  Logger.log('Firebase Messaging authorization is available.');
  return true;
}

/** Manual smoke test after authorization. */
function testFirebasePush() {
  const result = sendFirebaseTopicMessage_(
    'اختبار إشعار عائلة النتشة',
    'هذا إشعار تجريبي من لوحة الإدارة للتأكد من أن الإرسال المباشر يعمل بنجاح.',
    'system'
  );
  Logger.log(JSON.stringify(result));
  return result;
}
