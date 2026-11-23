package com.example.electroui.util;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;

import androidx.appcompat.app.AppCompatDelegate;

import com.example.electroui.R;

/** Тақырыптар: жарық / қараңғы / жүйелік режим және 4 акцент түс. */
public final class ThemeManager {
    public static final int MODE_SYSTEM = 0;
    public static final int MODE_LIGHT = 1;
    public static final int MODE_DARK = 2;

    public static final int[] THEMES = {
            R.style.Theme_ElectroUi_Blue, R.style.Theme_ElectroUi_Green,
            R.style.Theme_ElectroUi_Orange, R.style.Theme_ElectroUi_Purple};
    public static final String[] ACCENT_NAMES = {"Көк", "Жасыл", "Қызғылт сары", "Күлгін"};
    public static final int[] ACCENT_COLORS = {0xFF2F6BFF, 0xFF12A150, 0xFFF2701F, 0xFF7C4DFF};

    private ThemeManager() {
    }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences("ui", Context.MODE_PRIVATE);
    }

    public static int mode(Context c) {
        return prefs(c).getInt("theme_mode", MODE_SYSTEM);
    }

    public static int accent(Context c) {
        int a = prefs(c).getInt("accent", 0);
        return a >= 0 && a < THEMES.length ? a : 0;
    }

    public static void setMode(Context c, int mode) {
        prefs(c).edit().putInt("theme_mode", mode).apply();
        applyNightMode(c);
    }

    public static void setAccent(Context c, int accent) {
        prefs(c).edit().putInt("accent", accent).apply();
    }

    public static void applyNightMode(Context c) {
        int m = mode(c);
        AppCompatDelegate.setDefaultNightMode(m == MODE_LIGHT ? AppCompatDelegate.MODE_NIGHT_NO
                : m == MODE_DARK ? AppCompatDelegate.MODE_NIGHT_YES
                : AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
    }

    /** setContentView-ге дейін шақырылады. */
    public static void applyTheme(Activity a) {
        a.setTheme(THEMES[accent(a)]);
    }

    public static boolean isDark(Context c) {
        return (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
    }

    public static boolean notificationsEnabled(Context c) {
        return prefs(c).getBoolean("notifications", true);
    }

    public static void setNotificationsEnabled(Context c, boolean on) {
        prefs(c).edit().putBoolean("notifications", on).apply();
    }

    public static String accentHex(Context c) {
        return String.format("#%06X", 0xFFFFFF & ACCENT_COLORS[accent(c)]);
    }
}
