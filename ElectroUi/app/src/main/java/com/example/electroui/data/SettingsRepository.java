package com.example.electroui.data;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

/** Жүйелік баптаулар (тариф, қуат шектеулері) — settings кестесі. Өзгертуді тек әкімші жасайды. */
public class SettingsRepository {
    public static final String TARIFF = "tariff";
    public static final String LIMIT = "apartment_limit";
    public static final String ROOM_LIMIT = "room_limit";

    private final DbHelper db;

    public SettingsRepository(Context context) {
        db = DbHelper.get(context);
    }

    public String get(String key, String def) {
        try (Cursor c = db.getReadableDatabase().rawQuery("SELECT value FROM settings WHERE key = ?", new String[]{key})) {
            return c.moveToFirst() ? c.getString(0) : def;
        }
    }

    public void set(String key, String value) {
        ContentValues v = new ContentValues();
        v.put("key", key);
        v.put("value", value);
        db.getWritableDatabase().insertWithOnConflict("settings", null, v, SQLiteDatabase.CONFLICT_REPLACE);
    }

    /** ₸ / кВт·сағ */
    public double tariff() {
        try {
            return Double.parseDouble(get(TARIFF, "25"));
        } catch (NumberFormatException e) {
            return 25;
        }
    }

    /** Пәтердің кіріс автоматы: 32 А × 220 В ≈ 7000 Вт. */
    public int limit() {
        return parseInt(get(LIMIT, "7000"), 7000);
    }

    /** Бір бөлменің розетка желісі: 16 А × 220 В ≈ 3500 Вт. */
    public int roomLimit() {
        return parseInt(get(ROOM_LIMIT, "3500"), 3500);
    }

    private static int parseInt(String s, int def) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return def;
        }
    }
}
