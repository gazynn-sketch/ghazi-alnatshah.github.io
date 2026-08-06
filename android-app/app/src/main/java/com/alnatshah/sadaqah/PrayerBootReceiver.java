package com.alnatshah.sadaqah;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class PrayerBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!PrayerScheduleManager.isEnabled(context)) {
            return;
        }
        PendingResult pendingResult = goAsync();
        PrayerScheduleManager.refreshFromNetwork(context, pendingResult::finish);
    }
}
