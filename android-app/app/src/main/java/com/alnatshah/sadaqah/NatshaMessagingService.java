package com.alnatshah.sadaqah;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class NatshaMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "family_updates";

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "إشعارات عائلة النتشة",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("أخبار العائلة والمناسبات والتنبيهات المهمة");
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        ensureChannel(this);

        String title = remoteMessage.getData().get("title");
        String body = remoteMessage.getData().get("body");
        if (remoteMessage.getNotification() != null) {
            if (title == null || title.isEmpty()) title = remoteMessage.getNotification().getTitle();
            if (body == null || body.isEmpty()) body = remoteMessage.getNotification().getBody();
        }
        if (title == null || title.isEmpty()) title = "إشعار عائلة النتشة";
        if (body == null || body.isEmpty()) body = "لديك إشعار جديد من تطبيق عائلة النتشة";

        Intent openIntent = new Intent(this, MainActivity.class)
                .putExtra("openNotifications", true)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
                this,
                8301,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this)
                    .setPriority(Notification.PRIORITY_HIGH)
                    .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);
        }

        Notification notification = builder
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(openPending)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .build();

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            int id = 8000 + (int) (System.currentTimeMillis() % 1000);
            manager.notify(id, notification);
        }
    }
}
