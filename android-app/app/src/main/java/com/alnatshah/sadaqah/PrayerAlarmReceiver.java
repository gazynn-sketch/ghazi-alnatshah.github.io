package com.alnatshah.sadaqah;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class PrayerAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PrayerScheduleManager.createNotificationChannels(context);

        String kind = intent.getStringExtra("kind");
        String prayerName = intent.getStringExtra("prayerName");
        String label = intent.getStringExtra("label");
        if (prayerName == null || prayerName.isEmpty()) prayerName = "الصلاة";
        if (label == null || label.isEmpty()) label = "الموقع المحدد";

        if ("prayer".equals(kind) && intent.getBooleanExtra("adhanEnabled", true)) {
            Intent service = new Intent(context, AdhanService.class)
                    .putExtra("prayerName", prayerName)
                    .putExtra("label", label);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(service);
            } else {
                context.startService(service);
            }
            return;
        }

        int minutes = intent.getIntExtra("minutes", 0);
        String title;
        String text;
        if ("reminder".equals(kind)) {
            title = "اقترب وقت صلاة " + prayerName;
            text = "متبقي " + minutes + " دقائق • " + label;
        } else {
            title = "حان وقت صلاة " + prayerName;
            text = label;
        }
        postNotification(context, title, text, prayerName.hashCode());
    }

    private void postNotification(Context context, String title, String text, int id) {
        Intent openIntent = new Intent(context, MainActivity.class)
                .putExtra("openPrayer", true)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
                context,
                7100 + Math.abs(id % 500),
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, PrayerScheduleManager.CHANNEL_REMINDERS);
        } else {
            builder = new Notification.Builder(context)
                    .setPriority(Notification.PRIORITY_HIGH)
                    .setDefaults(Notification.DEFAULT_ALL);
        }

        Notification notification = builder
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(openPending)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .build();

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(5000 + Math.abs(id % 900), notification);
        }
    }
}
