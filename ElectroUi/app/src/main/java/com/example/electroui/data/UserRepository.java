package com.example.electroui.data;

import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import com.example.electroui.model.User;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/** Пайдаланушылар: тіркелу, кіру, рөлдер, бұғаттау. */
public class UserRepository {
    public static final int MAX_FAILS = 5;
    public static final long LOCK_MS = 30_000;
    private static final Pattern LOGIN = Pattern.compile("^[A-Za-z0-9_]{3,20}$");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$");

    private final DbHelper db;
    private final SharedPreferences guard;
    private final Context context;

    public UserRepository(Context context) {
        this.context = context.getApplicationContext();
        db = DbHelper.get(context);
        guard = this.context.getSharedPreferences("auth_guard", Context.MODE_PRIVATE);
    }

    // ------------------------------------------------------------------ тексеру ережелері
    public static void validateName(String name) throws AuthException {
        if (name.trim().length() < 2) throw new AuthException(AuthException.NAME, "Аты-жөніңізді жазыңыз");
    }

    public static void validateLogin(String login) throws AuthException {
        if (!LOGIN.matcher(login).matches())
            throw new AuthException(AuthException.LOGIN, "Логин: 3–20 таңба, латын әрпі, сан немесе _");
    }

    public static void validateEmail(String email) throws AuthException {
        if (!EMAIL.matcher(email.trim()).matches())
            throw new AuthException(AuthException.EMAIL, "Email дұрыс емес");
    }

    public static void validatePassword(String password) throws AuthException {
        boolean letter = false, digit = false;
        for (char ch : password.toCharArray()) {
            if (Character.isLetter(ch)) letter = true;
            if (Character.isDigit(ch)) digit = true;
        }
        if (password.length() < 8 || !letter || !digit)
            throw new AuthException(AuthException.PASSWORD, "Кемінде 8 таңба: әріп және сан болуы керек");
    }

    // ------------------------------------------------------------------ тіркелу
    public User register(String fullName, String login, String email, String password, String confirm)
            throws AuthException {
        validateName(fullName);
        validateLogin(login);
        validateEmail(email);
        validatePassword(password);
        if (!password.equals(confirm)) throw new AuthException(AuthException.CONFIRM, "Құпиясөздер сәйкес емес");
        if (byLogin(login) != null) throw new AuthException(AuthException.LOGIN, "Бұл логин бос емес");

        SQLiteDatabase w = db.getWritableDatabase();
        long id;
        w.beginTransaction();
        try {
            long now = System.currentTimeMillis();
            id = DbHelper.insertUser(w, login, fullName.trim(), email.trim(), password, User.CLIENT, now);
            DbHelper.createDefaultRooms(w, id);
            DbHelper.notification(w, id, "Тіркелу сәтті өтті!",
                    "Сәлем, " + fullName.trim() + "! Пәтеріңізде 4 бөлме дайын. Алғашқы құралды «Менің пәтерім» бөлімінде қосыңыз.",
                    "SUCCESS", now);
            w.setTransactionSuccessful();
        } finally {
            w.endTransaction();
        }
        return byId(id);
    }

    // ------------------------------------------------------------------ кіру
    public User login(String login, String password) throws AuthException {
        String key = login.trim().toLowerCase(Locale.ROOT);
        long lockedUntil = guard.getLong("lock_" + key, 0);
        long now = System.currentTimeMillis();
        if (lockedUntil > now) {
            long sec = (lockedUntil - now + 999) / 1000;
            throw new AuthException(AuthException.GENERAL, "Тым көп қате әрекет. " + sec + " секундтан кейін қайталаңыз");
        }
        if (login.trim().isEmpty()) throw new AuthException(AuthException.LOGIN, "Логинді жазыңыз");
        if (password.isEmpty()) throw new AuthException(AuthException.PASSWORD, "Құпиясөзді жазыңыз");

        String[] secret = secret(login.trim());
        if (secret == null || !PasswordHasher.verify(password, secret[1], secret[2])) {
            int fails = guard.getInt("fail_" + key, 0) + 1;
            SharedPreferences.Editor e = guard.edit().putInt("fail_" + key, fails);
            if (fails >= MAX_FAILS) e.putLong("lock_" + key, now + LOCK_MS).putInt("fail_" + key, 0);
            e.apply();
            int left = MAX_FAILS - fails;
            throw new AuthException(AuthException.PASSWORD, fails >= MAX_FAILS
                    ? "Кіру 30 секундқа бұғатталды"
                    : "Логин немесе құпиясөз қате (тағы " + left + " әрекет)");
        }
        guard.edit().remove("fail_" + key).remove("lock_" + key).apply();
        User u = byId(Long.parseLong(secret[0]));
        if (u.blocked) throw new AuthException(AuthException.GENERAL, "Аккаунт әкімші тарапынан бұғатталған");
        return u;
    }

    private String[] secret(String login) {
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT id, salt, password_hash FROM users WHERE login = ?", new String[]{login})) {
            return c.moveToFirst() ? new String[]{c.getString(0), c.getString(1), c.getString(2)} : null;
        }
    }

    /** Профильде көрсету үшін: дерекқорда сақталған тұз бен хэштің басы (құпиясөздің өзі жоқ!). */
    public String hashPreview(long userId) {
        User u = byId(userId);
        String[] s = u == null ? null : secret(u.login);
        if (s == null) return "";
        return "algorithm: " + PasswordHasher.ALGORITHM + "\niterations: " + PasswordHasher.ITERATIONS
                + "\nsalt: " + s[1].substring(0, 16) + "…\nhash: " + s[2].substring(0, 32) + "…";
    }

    public void changePassword(long userId, String oldPassword, String newPassword, String confirm)
            throws AuthException {
        User u = byId(userId);
        String[] s = u == null ? null : secret(u.login);
        if (s == null || !PasswordHasher.verify(oldPassword, s[1], s[2]))
            throw new AuthException(AuthException.GENERAL, "Ағымдағы құпиясөз қате");
        validatePassword(newPassword);
        if (!newPassword.equals(confirm)) throw new AuthException(AuthException.CONFIRM, "Құпиясөздер сәйкес емес");
        String salt = PasswordHasher.newSalt();
        ContentValues v = new ContentValues();
        v.put("salt", salt);
        v.put("password_hash", PasswordHasher.hash(newPassword, salt));
        db.getWritableDatabase().update("users", v, "id = ?", new String[]{String.valueOf(userId)});
    }

    public void updateProfile(long userId, String fullName, String email) throws AuthException {
        validateName(fullName);
        validateEmail(email);
        ContentValues v = new ContentValues();
        v.put("full_name", fullName.trim());
        v.put("email", email.trim());
        db.getWritableDatabase().update("users", v, "id = ?", new String[]{String.valueOf(userId)});
    }

    // ------------------------------------------------------------------ оқу
    public User byId(long id) {
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT id, login, full_name, email, role, blocked, created_at FROM users WHERE id = ?",
                new String[]{String.valueOf(id)})) {
            return c.moveToFirst() ? read(c) : null;
        }
    }

    public User byLogin(String login) {
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT id, login, full_name, email, role, blocked, created_at FROM users WHERE login = ?",
                new String[]{login})) {
            return c.moveToFirst() ? read(c) : null;
        }
    }

    public List<User> all() {
        List<User> list = new ArrayList<>();
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT id, login, full_name, email, role, blocked, created_at FROM users ORDER BY role, full_name COLLATE NOCASE",
                null)) {
            while (c.moveToNext()) list.add(read(c));
        }
        return list;
    }

    public int count(String role) {
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT COUNT(*) FROM users WHERE role = ?", new String[]{role})) {
            return c.moveToFirst() ? c.getInt(0) : 0;
        }
    }

    private static User read(Cursor c) {
        return new User(c.getLong(0), c.getString(1), c.getString(2), c.getString(3), c.getString(4),
                c.getInt(5) == 1, c.getLong(6));
    }

    // ------------------------------------------------------------------ әкімші әрекеттері
    public void setRole(long userId, String role) {
        ContentValues v = new ContentValues();
        v.put("role", User.ADMIN.equals(role) ? User.ADMIN : User.CLIENT);
        db.getWritableDatabase().update("users", v, "id = ?", new String[]{String.valueOf(userId)});
    }

    public void setBlocked(long userId, boolean blocked) {
        ContentValues v = new ContentValues();
        v.put("blocked", blocked ? 1 : 0);
        db.getWritableDatabase().update("users", v, "id = ?", new String[]{String.valueOf(userId)});
    }

    /** ON DELETE CASCADE арқылы бөлмелері, құралдары, хабарламалары да өшеді. */
    public void delete(long userId) {
        db.getWritableDatabase().delete("users", "id = ?", new String[]{String.valueOf(userId)});
    }
}
