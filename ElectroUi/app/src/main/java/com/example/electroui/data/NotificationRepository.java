package com.example.electroui.data;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import com.example.electroui.model.AppNotification;

import java.util.ArrayList;
import java.util.List;

/** Хабарламалар кестесі. */
public class NotificationRepository {
    private final DbHelper db;

    public NotificationRepository(Context context) {
        db = DbHelper.get(context);
    }

    public long add(long userId, String title, String body, String kind) {
        ContentValues v = new ContentValues();
        v.put("user_id", userId);
        v.put("title", title);
        v.put("body", body);
        v.put("kind", kind);
        v.put("is_read", 0);
        v.put("created_at", System.currentTimeMillis());
        return db.getWritableDatabase().insert("notifications", null, v);
    }

    /** Әкімшінің хабарламасы — барлық клиентке бір транзакцияда. */
    public int broadcastToClients(String title, String body) {
        SQLiteDatabase w = db.getWritableDatabase();
        int n = 0;
        w.beginTransaction();
        try (Cursor c = w.rawQuery("SELECT id FROM users WHERE role = 'CLIENT' AND blocked = 0", null)) {
            while (c.moveToNext()) {
                add(c.getLong(0), title, body, AppNotification.ADMIN);
                n++;
            }
            w.setTransactionSuccessful();
        } finally {
            w.endTransaction();
        }
        return n;
    }

    public List<AppNotification> list(long userId) {
        List<AppNotification> list = new ArrayList<>();
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT id, title, body, kind, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC",
                new String[]{String.valueOf(userId)})) {
            while (c.moveToNext())
                list.add(new AppNotification(c.getLong(0), c.getString(1), c.getString(2), c.getString(3),
                        c.getInt(4) == 1, c.getLong(5)));
        }
        return list;
    }

    public int unread(long userId) {
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0",
                new String[]{String.valueOf(userId)})) {
            return c.moveToFirst() ? c.getInt(0) : 0;
        }
    }

    public void markRead(long id) {
        ContentValues v = new ContentValues();
        v.put("is_read", 1);
        db.getWritableDatabase().update("notifications", v, "id = ?", new String[]{String.valueOf(id)});
    }

    public void markAllRead(long userId) {
        ContentValues v = new ContentValues();
        v.put("is_read", 1);
        db.getWritableDatabase().update("notifications", v, "user_id = ?", new String[]{String.valueOf(userId)});
    }

    public void delete(long id) {
        db.getWritableDatabase().delete("notifications", "id = ?", new String[]{String.valueOf(id)});
    }

    public void clear(long userId) {
        db.getWritableDatabase().delete("notifications", "user_id = ?", new String[]{String.valueOf(userId)});
    }
}
