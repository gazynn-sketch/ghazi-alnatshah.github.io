package com.alnatshah.sadaqah;

import android.app.Application;

import com.google.firebase.messaging.FirebaseMessaging;

public class NatshaApplication extends Application {
    public static final String FAMILY_TOPIC = "natsha_family_all";

    @Override
    public void onCreate() {
        super.onCreate();
        PrayerScheduleManager.createNotificationChannels(this);
        NatshaMessagingService.ensureChannel(this);
        FirebaseMessaging.getInstance().subscribeToTopic(FAMILY_TOPIC);
    }
}
