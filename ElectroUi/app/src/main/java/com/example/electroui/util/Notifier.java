package com.example.electroui.util;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.example.electroui.MainActivity;
import com.example.electroui.R;
import com.example.electroui.model.AppNotification;

/** Android жүйелік хабарламалары (Notification). */
public final class Notifier {
    public static final String CH_ALERTS = "power_alerts";
    public static final String CH_NEWS = "news";
    public static final String EXTRA_OPEN = "open";
    private static int nextId = 100;

    private Notifier() {
    }

    public static void createChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel alerts = new NotificationChannel(CH_ALERTS, "Қуат ескертулері",
                NotificationManager.IMPORTANCE_HIGH);
        alerts.setDescription("Желі шамадан тыс жүктелгенде ескерту");
        alerts.enableVibration(true);
        NotificationChannel news = new NotificationChannel(CH_NEWS, "Жаңалықтар мен хабарламалар",
                NotificationManager.IMPORTANCE_DEFAULT);
        news.setDescription("Әкімшінің хабарламалары, тіркелу, жүйе");
        nm.createNotificationChannel(alerts);
        nm.createNotificationChannel(news);
    }

    public static boolean permissionGranted(Context c) {
        return Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(c,
                Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    public static void show(Context c, String title, String body, String kind) {
        if (!ThemeManager.notificationsEnabled(c) || !permissionGranted(c)) return;
        Intent open = new Intent(c, MainActivity.class)
                .putExtra(EXTRA_OPEN, "notifications")
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 7, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        boolean warning = AppNotification.WARNING.equals(kind);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, warning ? CH_ALERTS : CH_NEWS)
                .setSmallIcon(R.drawable.ic_bolt)
                .setColor(warning ? 0xFFE5484D : ThemeManager.ACCENT_COLORS[ThemeManager.accent(c)])
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(warning ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(warning ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_MESSAGE)
                .setContentIntent(pi)
                .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(c).notify(nextId++, b.build());
        } catch (SecurityException ignored) {
            // рұқсат жоқ — тек қосымша ішіндегі хабарлама қалады
        }
    }
}
