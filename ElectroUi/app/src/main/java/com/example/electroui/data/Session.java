package com.example.electroui.data;

import android.content.Context;
import android.content.SharedPreferences;

import com.example.electroui.model.User;

/** Кірген пайдаланушының сессиясы (SharedPreferences ішінде тек id сақталады). */
public final class Session {
    private static final String PREFS = "session";
    private static final String KEY_USER = "user_id";

    private Session() {
    }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void start(Context c, long userId) {
        prefs(c).edit().putLong(KEY_USER, userId).putBoolean("greeted", false).apply();
    }

    public static long userId(Context c) {
        return prefs(c).getLong(KEY_USER, 0);
    }

    /** Ағымдағы пайдаланушы; жойылған не бұғатталған болса — null. */
    public static User user(Context c) {
        long id = userId(c);
        if (id == 0) return null;
        User u = new UserRepository(c).byId(id);
        if (u == null || u.blocked) {
            end(c);
            return null;
        }
        return u;
    }

    public static boolean takeGreeting(Context c) {
        boolean greeted = prefs(c).getBoolean("greeted", false);
        if (!greeted) prefs(c).edit().putBoolean("greeted", true).apply();
        return !greeted;
    }

    public static void end(Context c) {
        prefs(c).edit().remove(KEY_USER).apply();
    }
}
