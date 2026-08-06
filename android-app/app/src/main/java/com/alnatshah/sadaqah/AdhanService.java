package com.alnatshah.sadaqah;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;

public class AdhanService extends Service {
    private static final String ACTION_STOP = "com.alnatshah.sadaqah.STOP_ADHAN";
    private static final int NOTIFICATION_ID = 6201;
    private static final String ADHAN_URL = "https://upload.wikimedia.org/wikipedia/commons/b/b0/Beautiful_adhan.ogg";

    private MediaPlayer player;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String prayerName = intent != null ? intent.getStringExtra("prayerName") : null;
        String label = intent != null ? intent.getStringExtra("label") : null;
        if (prayerName == null || prayerName.isEmpty()) prayerName = "الصلاة";
        if (label == null || label.isEmpty()) label = "الموقع المحدد";

        PrayerScheduleManager.createNotificationChannels(this);
        startForeground(NOTIFICATION_ID, buildNotification(prayerName, label));
        playAdhan();
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String prayerName, String label) {
        Intent openIntent = new Intent(this, MainActivity.class)
                .putExtra("openPrayer", true)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
                this,
                6202,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, AdhanService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
                this,
                6203,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, PrayerScheduleManager.CHANNEL_ADHAN);
        } else {
            builder = new Notification.Builder(this).setPriority(Notification.PRIORITY_HIGH);
        }

        return builder
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("حان وقت صلاة " + prayerName)
                .setContentText(label + " • يتم تشغيل الأذان")
                .setStyle(new Notification.BigTextStyle().bigText(label + " • يتم تشغيل الأذان الكامل"))
                .setContentIntent(openPending)
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .addAction(new Notification.Action.Builder(
                        R.drawable.ic_notification,
                        "إيقاف الأذان",
                        stopPending
                ).build())
                .build();
    }

    private void playAdhan() {
        stopPlayer();
        try {
            player = new MediaPlayer();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                player.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build());
            }
            player.setDataSource(ADHAN_URL);
            player.setLooping(false);
            player.setOnPreparedListener(MediaPlayer::start);
            player.setOnCompletionListener(mp -> stopSelf());
            player.setOnErrorListener((mp, what, extra) -> {
                stopSelf();
                return true;
            });
            player.prepareAsync();
        } catch (Exception ignored) {
            stopSelf();
        }
    }

    private void stopPlayer() {
        if (player != null) {
            try {
                if (player.isPlaying()) player.stop();
            } catch (Exception ignored) {
            }
            player.release();
            player = null;
        }
    }

    @Override
    public void onDestroy() {
        stopPlayer();
        stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
