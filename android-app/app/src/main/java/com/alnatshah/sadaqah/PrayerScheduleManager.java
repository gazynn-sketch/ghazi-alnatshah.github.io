package com.alnatshah.sadaqah;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public final class PrayerScheduleManager {
    static final String PREFS = "natsha_prayer_alerts";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_CONFIG = "config";
    static final String CHANNEL_REMINDERS = "prayer_reminders";
    static final String CHANNEL_ADHAN = "adhan_playback";
    static final String ACTION_REFRESH = "com.alnatshah.sadaqah.REFRESH_PRAYERS";

    private static final String[] PRAYER_KEYS = {"Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"};
    private static final String[] PRAYER_NAMES = {"الفجر", "الظهر", "العصر", "المغرب", "العشاء"};

    private PrayerScheduleManager() {
    }

    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        NotificationChannel reminders = new NotificationChannel(
                CHANNEL_REMINDERS,
                "تنبيهات أوقات الصلاة",
                NotificationManager.IMPORTANCE_HIGH
        );
        reminders.setDescription("تنبيه قبل الصلاة وعند دخول وقتها");
        reminders.enableVibration(true);

        NotificationChannel adhan = new NotificationChannel(
                CHANNEL_ADHAN,
                "تشغيل الأذان",
                NotificationManager.IMPORTANCE_HIGH
        );
        adhan.setDescription("تشغيل الأذان الكامل عند دخول وقت الصلاة");
        adhan.setSound(null, null);
        adhan.enableVibration(false);

        manager.createNotificationChannel(reminders);
        manager.createNotificationChannel(adhan);
    }

    public static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    public static String getSavedConfiguration(Context context) {
        return prefs(context).getString(KEY_CONFIG, "");
    }

    public static void saveAndSchedule(Context context, String json) {
        prefs(context).edit()
                .putBoolean(KEY_ENABLED, true)
                .putString(KEY_CONFIG, json)
                .apply();
        scheduleFromJson(context, json);
    }

    public static void disable(Context context) {
        prefs(context).edit().putBoolean(KEY_ENABLED, false).apply();
        cancelAll(context);
        try {
            context.stopService(new Intent(context, AdhanService.class));
        } catch (Exception ignored) {
        }
    }

    public static void rescheduleSaved(Context context) {
        if (!isEnabled(context)) {
            return;
        }
        String config = getSavedConfiguration(context);
        if (!config.isEmpty()) {
            scheduleFromJson(context, config);
        }
    }

    public static void refreshFromNetwork(Context context, Runnable finished) {
        if (!isEnabled(context)) {
            if (finished != null) finished.run();
            return;
        }

        new Thread(() -> {
            try {
                String saved = getSavedConfiguration(context);
                if (saved.isEmpty()) {
                    return;
                }
                JSONObject config = new JSONObject(saved);
                String source = config.optString("source", "city");
                int method = config.optInt("method", 3);
                int school = config.optInt("school", 0);
                String date = new SimpleDateFormat("dd-MM-yyyy", Locale.US).format(new Date());
                String endpoint;

                if ("coords".equals(source)) {
                    double lat = config.getDouble("lat");
                    double lng = config.getDouble("lng");
                    endpoint = "https://api.aladhan.com/v1/timings/" + date
                            + "?latitude=" + lat
                            + "&longitude=" + lng
                            + "&method=" + method
                            + "&school=" + school;
                } else {
                    String city = URLEncoder.encode(config.optString("city", "Amman"), StandardCharsets.UTF_8.name());
                    String country = URLEncoder.encode(config.optString("country", "Jordan"), StandardCharsets.UTF_8.name());
                    endpoint = "https://api.aladhan.com/v1/timingsByCity/" + date
                            + "?city=" + city
                            + "&country=" + country
                            + "&method=" + method
                            + "&school=" + school;
                }

                HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "NatshaFamilyAndroid/1.2.1");

                if (connection.getResponseCode() == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                    StringBuilder body = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        body.append(line);
                    }
                    reader.close();

                    JSONObject response = new JSONObject(body.toString());
                    JSONObject data = response.getJSONObject("data");
                    config.put("timings", data.getJSONObject("timings"));
                    config.put("lastUpdated", System.currentTimeMillis());
                    String updated = config.toString();
                    prefs(context).edit().putString(KEY_CONFIG, updated).apply();
                    scheduleFromJson(context, updated);
                } else {
                    rescheduleSaved(context);
                }
                connection.disconnect();
            } catch (Exception ignored) {
                rescheduleSaved(context);
            } finally {
                if (finished != null) finished.run();
            }
        }, "NatshaPrayerRefresh").start();
    }

    public static void scheduleFromJson(Context context, String json) {
        createNotificationChannels(context);
        cancelPrayerAlarms(context);

        try {
            JSONObject config = new JSONObject(json);
            JSONObject timings = config.getJSONObject("timings");
            int reminderMinutes = Math.max(0, Math.min(60, config.optInt("reminderMinutes", 10)));
            boolean adhanEnabled = config.optBoolean("adhanEnabled", true);
            String label = config.optString("label", "الموقع المحدد");

            Calendar now = Calendar.getInstance();
            for (int i = 0; i < PRAYER_KEYS.length; i++) {
                String raw = timings.optString(PRAYER_KEYS[i], "");
                String time = cleanTime(raw);
                if (!time.matches("\\d{1,2}:\\d{2}")) {
                    continue;
                }
                String[] parts = time.split(":");
                int hour = Integer.parseInt(parts[0]);
                int minute = Integer.parseInt(parts[1]);

                Calendar at = Calendar.getInstance();
                at.set(Calendar.HOUR_OF_DAY, hour);
                at.set(Calendar.MINUTE, minute);
                at.set(Calendar.SECOND, 0);
                at.set(Calendar.MILLISECOND, 0);

                if (at.after(now)) {
                    schedulePrayerAlarm(context, i, at.getTimeInMillis(), PRAYER_NAMES[i], label, adhanEnabled);
                    if (reminderMinutes > 0) {
                        long reminderAt = at.getTimeInMillis() - reminderMinutes * 60_000L;
                        if (reminderAt > System.currentTimeMillis()) {
                            scheduleReminderAlarm(context, i, reminderAt, PRAYER_NAMES[i], reminderMinutes, label);
                        }
                    }
                }
            }
            scheduleDailyRefresh(context);
        } catch (Exception ignored) {
            scheduleDailyRefresh(context);
        }
    }

    private static void schedulePrayerAlarm(
            Context context,
            int index,
            long triggerAt,
            String prayerName,
            String label,
            boolean adhanEnabled
    ) {
        Intent intent = new Intent(context, PrayerAlarmReceiver.class)
                .setAction("PRAYER_" + index)
                .putExtra("kind", "prayer")
                .putExtra("prayerName", prayerName)
                .putExtra("label", label)
                .putExtra("adhanEnabled", adhanEnabled);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                2000 + index * 10,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        setAlarm(context, triggerAt, pendingIntent);
    }

    private static void scheduleReminderAlarm(
            Context context,
            int index,
            long triggerAt,
            String prayerName,
            int minutes,
            String label
    ) {
        Intent intent = new Intent(context, PrayerAlarmReceiver.class)
                .setAction("REMINDER_" + index)
                .putExtra("kind", "reminder")
                .putExtra("prayerName", prayerName)
                .putExtra("label", label)
                .putExtra("minutes", minutes);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                2001 + index * 10,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        setAlarm(context, triggerAt, pendingIntent);
    }

    private static void scheduleDailyRefresh(Context context) {
        Calendar next = Calendar.getInstance();
        next.add(Calendar.DAY_OF_YEAR, 1);
        next.set(Calendar.HOUR_OF_DAY, 0);
        next.set(Calendar.MINUTE, 5);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);

        Intent intent = new Intent(context, PrayerBootReceiver.class).setAction(ACTION_REFRESH);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                9900,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        setAlarm(context, next.getTimeInMillis(), pendingIntent);
    }

    private static void setAlarm(Context context, long triggerAt, PendingIntent pendingIntent) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        } else {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        }
    }

    public static void cancelAll(Context context) {
        cancelPrayerAlarms(context);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        Intent refresh = new Intent(context, PrayerBootReceiver.class).setAction(ACTION_REFRESH);
        PendingIntent pending = PendingIntent.getBroadcast(
                context,
                9900,
                refresh,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pending != null) {
            alarmManager.cancel(pending);
            pending.cancel();
        }
    }

    private static void cancelPrayerAlarms(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        for (int i = 0; i < PRAYER_KEYS.length; i++) {
            Intent prayer = new Intent(context, PrayerAlarmReceiver.class).setAction("PRAYER_" + i);
            PendingIntent prayerPending = PendingIntent.getBroadcast(
                    context,
                    2000 + i * 10,
                    prayer,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
            );
            if (prayerPending != null) {
                alarmManager.cancel(prayerPending);
                prayerPending.cancel();
            }

            Intent reminder = new Intent(context, PrayerAlarmReceiver.class).setAction("REMINDER_" + i);
            PendingIntent reminderPending = PendingIntent.getBroadcast(
                    context,
                    2001 + i * 10,
                    reminder,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
            );
            if (reminderPending != null) {
                alarmManager.cancel(reminderPending);
                reminderPending.cancel();
            }
        }
    }

    private static String cleanTime(String value) {
        int space = value.indexOf(' ');
        return space >= 0 ? value.substring(0, space) : value;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
