from pathlib import Path

ROOT = Path('.')


def replace_once(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

# Root Gradle: Google services plugin.
replace_once(
    'android-app/build.gradle.kts',
    '    id("com.android.application") version "9.3.0" apply false\n',
    '    id("com.android.application") version "9.3.0" apply false\n'
    '    id("com.google.gms.google-services") version "4.5.0" apply false\n'
)

# App Gradle: plugin + FCM + version bump.
replace_once(
    'android-app/app/build.gradle.kts',
    'plugins {\n    id("com.android.application")\n}\n',
    'plugins {\n    id("com.android.application")\n    id("com.google.gms.google-services")\n}\n'
)
replace_once(
    'android-app/app/build.gradle.kts',
    '        versionCode = 5\n        versionName = "1.2.2"\n',
    '        versionCode = 6\n        versionName = "1.2.3"\n'
)
app_gradle = ROOT / 'android-app/app/build.gradle.kts'
text = app_gradle.read_text(encoding='utf-8')
if 'com.google.firebase:firebase-messaging' not in text:
    text = text.rstrip() + '''\n\ndependencies {\n    implementation(platform("com.google.firebase:firebase-bom:34.17.0"))\n    implementation("com.google.firebase:firebase-messaging")\n}\n'''
    app_gradle.write_text(text, encoding='utf-8')

# Manifest: Application class, FCM service, channel defaults.
manifest = ROOT / 'android-app/app/src/main/AndroidManifest.xml'
text = manifest.read_text(encoding='utf-8')
if 'android:name=".NatshaApplication"' not in text:
    text = text.replace(
        '    <application\n        android:allowBackup="true"',
        '    <application\n        android:name=".NatshaApplication"\n        android:allowBackup="true"',
        1,
    )
if '.NatshaMessagingService' not in text:
    marker = '''        <service\n            android:name=".AdhanService"'''
    addition = '''        <service\n            android:name=".NatshaMessagingService"\n            android:exported="false">\n            <intent-filter>\n                <action android:name="com.google.firebase.MESSAGING_EVENT" />\n            </intent-filter>\n        </service>\n\n        <meta-data\n            android:name="com.google.firebase.messaging.default_notification_icon"\n            android:resource="@drawable/ic_notification" />\n        <meta-data\n            android:name="com.google.firebase.messaging.default_notification_channel_id"\n            android:value="family_updates" />\n        <meta-data\n            android:name="firebase_messaging_installation_id_enabled"\n            android:value="true" />\n\n'''
    if marker not in text:
        raise SystemExit('AdhanService marker not found in manifest')
    text = text.replace(marker, addition + marker, 1)
manifest.write_text(text, encoding='utf-8')

# Application class subscribes every install to the family broadcast topic.
app_java = ROOT / 'android-app/app/src/main/java/com/alnatshah/sadaqah/NatshaApplication.java'
app_java.write_text('''package com.alnatshah.sadaqah;\n\nimport android.app.Application;\n\nimport com.google.firebase.messaging.FirebaseMessaging;\n\npublic class NatshaApplication extends Application {\n    public static final String FAMILY_TOPIC = "natsha_family_all";\n\n    @Override\n    public void onCreate() {\n        super.onCreate();\n        PrayerScheduleManager.createNotificationChannels(this);\n        NatshaMessagingService.ensureChannel(this);\n        FirebaseMessaging.getInstance().subscribeToTopic(FAMILY_TOPIC);\n    }\n}\n''', encoding='utf-8')

# FCM receiver creates high-priority Heads-up notifications.
service_java = ROOT / 'android-app/app/src/main/java/com/alnatshah/sadaqah/NatshaMessagingService.java'
service_java.write_text('''package com.alnatshah.sadaqah;\n\nimport android.app.Notification;\nimport android.app.NotificationChannel;\nimport android.app.NotificationManager;\nimport android.app.PendingIntent;\nimport android.content.Context;\nimport android.content.Intent;\nimport android.os.Build;\n\nimport com.google.firebase.messaging.FirebaseMessagingService;\nimport com.google.firebase.messaging.RemoteMessage;\n\npublic class NatshaMessagingService extends FirebaseMessagingService {\n    public static final String CHANNEL_ID = "family_updates";\n\n    public static void ensureChannel(Context context) {\n        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;\n        NotificationManager manager = context.getSystemService(NotificationManager.class);\n        if (manager == null) return;\n        NotificationChannel channel = new NotificationChannel(\n                CHANNEL_ID,\n                "إشعارات عائلة النتشة",\n                NotificationManager.IMPORTANCE_HIGH\n        );\n        channel.setDescription("أخبار العائلة والمناسبات والتنبيهات المهمة");\n        channel.enableVibration(true);\n        manager.createNotificationChannel(channel);\n    }\n\n    @Override\n    public void onMessageReceived(RemoteMessage remoteMessage) {\n        super.onMessageReceived(remoteMessage);\n        ensureChannel(this);\n\n        String title = remoteMessage.getData().get("title");\n        String body = remoteMessage.getData().get("body");\n        if (remoteMessage.getNotification() != null) {\n            if (title == null || title.isEmpty()) title = remoteMessage.getNotification().getTitle();\n            if (body == null || body.isEmpty()) body = remoteMessage.getNotification().getBody();\n        }\n        if (title == null || title.isEmpty()) title = "إشعار عائلة النتشة";\n        if (body == null || body.isEmpty()) body = "لديك إشعار جديد من تطبيق عائلة النتشة";\n\n        Intent openIntent = new Intent(this, MainActivity.class)\n                .putExtra("openNotifications", true)\n                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);\n        PendingIntent openPending = PendingIntent.getActivity(\n                this,\n                8301,\n                openIntent,\n                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE\n        );\n\n        Notification.Builder builder;\n        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n            builder = new Notification.Builder(this, CHANNEL_ID);\n        } else {\n            builder = new Notification.Builder(this)\n                    .setPriority(Notification.PRIORITY_HIGH)\n                    .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);\n        }\n\n        Notification notification = builder\n                .setSmallIcon(R.drawable.ic_notification)\n                .setContentTitle(title)\n                .setContentText(body)\n                .setStyle(new Notification.BigTextStyle().bigText(body))\n                .setContentIntent(openPending)\n                .setAutoCancel(true)\n                .setCategory(Notification.CATEGORY_MESSAGE)\n                .setVisibility(Notification.VISIBILITY_PUBLIC)\n                .build();\n\n        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);\n        if (manager != null) {\n            int id = 8000 + (int) (System.currentTimeMillis() % 1000);\n            manager.notify(id, notification);\n        }\n    }\n}\n''', encoding='utf-8')

# MainActivity: permission prompt and routing when a push is tapped.
main = ROOT / 'android-app/app/src/main/java/com/alnatshah/sadaqah/MainActivity.java'
text = main.read_text(encoding='utf-8')
if 'NOTIFICATIONS_URL' not in text:
    text = text.replace(
        '    private static final String PRAYER_URL = HOME_URL + "prayer.html";\n',
        '    private static final String PRAYER_URL = HOME_URL + "prayer.html";\n'
        '    private static final String NOTIFICATIONS_URL = HOME_URL + "notifications.html";\n',
        1,
    )
if 'PUSH_NOTIFICATION_REQUEST' not in text:
    text = text.replace(
        '    private static final int NOTIFICATION_REQUEST = 1102;\n',
        '    private static final int NOTIFICATION_REQUEST = 1102;\n'
        '    private static final int PUSH_NOTIFICATION_REQUEST = 1103;\n',
        1,
    )
text = text.replace('NatshaFamilyAndroid/1.2.2', 'NatshaFamilyAndroid/1.2.3')
if 'requestPushNotificationPermissionIfNeeded();' not in text:
    text = text.replace(
        '        configureWebView();\n\n        boolean openPrayer',
        '        configureWebView();\n        requestPushNotificationPermissionIfNeeded();\n\n        boolean openPrayer',
        1,
    )
old_start = '''        boolean openPrayer = getIntent() != null && getIntent().getBooleanExtra("openPrayer", false);\n        if (savedInstanceState == null || openPrayer) {\n            webView.loadUrl(openPrayer ? PRAYER_URL : HOME_URL);\n        } else {\n            webView.restoreState(savedInstanceState);\n        }\n'''
new_start = '''        boolean openPrayer = getIntent() != null && getIntent().getBooleanExtra("openPrayer", false);\n        boolean openNotifications = getIntent() != null && getIntent().getBooleanExtra("openNotifications", false);\n        if (savedInstanceState == null || openPrayer || openNotifications) {\n            String startUrl = openPrayer ? PRAYER_URL : (openNotifications ? NOTIFICATIONS_URL : HOME_URL);\n            webView.loadUrl(startUrl);\n        } else {\n            webView.restoreState(savedInstanceState);\n        }\n'''
if old_start in text:
    text = text.replace(old_start, new_start, 1)
if 'private void requestPushNotificationPermissionIfNeeded()' not in text:
    marker = '    private void requestPrayerPermissions() {'
    method = '''    private void requestPushNotificationPermissionIfNeeded() {\n        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU\n                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)\n                != PackageManager.PERMISSION_GRANTED) {\n            requestPermissions(\n                    new String[]{Manifest.permission.POST_NOTIFICATIONS},\n                    PUSH_NOTIFICATION_REQUEST\n            );\n        }\n    }\n\n'''
    if marker not in text:
        raise SystemExit('requestPrayerPermissions marker not found')
    text = text.replace(marker, method + marker, 1)
old_new_intent = '''        if (intent != null && intent.getBooleanExtra("openPrayer", false) && webView != null) {\n            webView.loadUrl(PRAYER_URL);\n        }\n'''
new_new_intent = '''        if (intent != null && webView != null) {\n            if (intent.getBooleanExtra("openPrayer", false)) {\n                webView.loadUrl(PRAYER_URL);\n            } else if (intent.getBooleanExtra("openNotifications", false)) {\n                webView.loadUrl(NOTIFICATIONS_URL);\n            }\n        }\n'''
if old_new_intent in text:
    text = text.replace(old_new_intent, new_new_intent, 1)
main.write_text(text, encoding='utf-8')

# Build workflow and home download link move to v1.2.3.
workflow = ROOT / '.github/workflows/build-android-apk.yml'
text = workflow.read_text(encoding='utf-8').replace('v1.2.2', 'v1.2.3')
workflow.write_text(text, encoding='utf-8')
index = ROOT / 'index.html'
text = index.read_text(encoding='utf-8')
text = text.replace('downloads/Natsha-Family-v1.1.0.apk', 'downloads/Natsha-Family-v1.2.3.apk')
text = text.replace('downloads/Natsha-Family-v1.2.2.apk', 'downloads/Natsha-Family-v1.2.3.apk')
index.write_text(text, encoding='utf-8')

print('Firebase push integration prepared.')
