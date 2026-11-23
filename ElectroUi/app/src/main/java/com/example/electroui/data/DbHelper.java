package com.example.electroui.data;

import android.content.ContentValues;
import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.example.electroui.model.User;

/**
 * SQLite дерекқоры: electroui.db.
 * Кестелер: users, rooms, catalog, appliances, notifications, events, settings.
 */
public class DbHelper extends SQLiteOpenHelper {
    public static final String NAME = "electroui.db";
    public static final int VERSION = 1;

    public static final String[] TABLES = {"users", "rooms", "catalog", "appliances", "notifications", "events", "settings"};
    public static final String[] DEFAULT_ROOMS = {"Ас үй", "Қонақ бөлме", "Жатын бөлме", "Жуынатын бөлме"};
    public static final int[] DEFAULT_SOCKETS = {4, 5, 3, 2};

    private static DbHelper instance;

    public static synchronized DbHelper get(Context context) {
        if (instance == null) instance = new DbHelper(context.getApplicationContext());
        return instance;
    }

    private DbHelper(Context context) {
        super(context, NAME, null, VERSION);
    }

    @Override
    public void onConfigure(SQLiteDatabase db) {
        db.setForeignKeyConstraintsEnabled(true);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE users (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "login TEXT NOT NULL UNIQUE COLLATE NOCASE," +
                "full_name TEXT NOT NULL," +
                "email TEXT NOT NULL," +
                "salt TEXT NOT NULL," +
                "password_hash TEXT NOT NULL," +
                "role TEXT NOT NULL DEFAULT 'CLIENT' CHECK (role IN ('ADMIN','CLIENT'))," +
                "blocked INTEGER NOT NULL DEFAULT 0," +
                "created_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE rooms (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
                "name TEXT NOT NULL," +
                "sockets INTEGER NOT NULL CHECK (sockets > 0))");
        db.execSQL("CREATE TABLE catalog (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "type TEXT NOT NULL," +
                "name TEXT NOT NULL," +
                "brand TEXT NOT NULL," +
                "power INTEGER NOT NULL CHECK (power > 0)," +
                "voltage INTEGER NOT NULL CHECK (voltage > 0)," +
                "energy_class TEXT NOT NULL," +
                "weight REAL NOT NULL," +
                "extra REAL NOT NULL," +
                "hours REAL NOT NULL)");
        db.execSQL("CREATE TABLE appliances (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
                "room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE," +
                "type TEXT NOT NULL," +
                "name TEXT NOT NULL," +
                "brand TEXT NOT NULL," +
                "power INTEGER NOT NULL CHECK (power > 0)," +
                "voltage INTEGER NOT NULL CHECK (voltage > 0)," +
                "energy_class TEXT NOT NULL," +
                "weight REAL NOT NULL," +
                "extra REAL NOT NULL," +
                "hours REAL NOT NULL," +
                "plugged INTEGER NOT NULL DEFAULT 0," +
                "created_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE notifications (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
                "title TEXT NOT NULL," +
                "body TEXT NOT NULL," +
                "kind TEXT NOT NULL DEFAULT 'INFO'," +
                "is_read INTEGER NOT NULL DEFAULT 0," +
                "created_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE events (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
                "appliance_name TEXT NOT NULL," +
                "action TEXT NOT NULL," +
                "power INTEGER NOT NULL," +
                "at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
        db.execSQL("CREATE INDEX idx_appliances_user ON appliances(user_id)");
        db.execSQL("CREATE INDEX idx_notifications_user ON notifications(user_id, is_read)");
        seed(db);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        for (int i = TABLES.length - 1; i >= 0; i--) db.execSQL("DROP TABLE IF EXISTS " + TABLES[i]);
        onCreate(db);
    }

    // ------------------------------------------------------------------ бастапқы деректер
    private void seed(SQLiteDatabase db) {
        setting(db, SettingsRepository.TARIFF, "25");
        setting(db, SettingsRepository.LIMIT, "7000");
        setting(db, SettingsRepository.ROOM_LIMIT, "3500");

        Object[][] catalog = {
                {"KETTLE", "Bosch TWK7203", "Bosch", 2200, 220, "A", 1.3, 1.7, 0.5},
                {"FRIDGE", "Panasonic NR-C320", "Panasonic", 150, 220, "A++", 62.0, 320.0, 8.0},
                {"MICROWAVE", "Panasonic NN-GM333", "Panasonic", 1150, 220, "A", 11.0, 23.0, 0.3},
                {"WASHER", "Samsung WW70", "Samsung", 2000, 220, "A+++", 60.0, 7.0, 1.0},
                {"VACUUM", "Hitachi CV-HG5", "Hitachi", 1600, 220, "A", 5.2, 1.5, 0.3},
                {"IRON", "Hitachi CSI-M701", "Hitachi", 1400, 220, "A", 1.2, 200.0, 0.3},
                {"TV", "Samsung LA40C550", "Samsung", 110, 220, "A", 13.0, 40.0, 4.0},
                {"COMPUTER", "Gaming PC RGB", "Custom", 450, 220, "B", 9.0, 32.0, 6.0},
                {"AIRCON", "Panasonic CS-C10", "Panasonic", 900, 220, "A++", 9.0, 25.0, 6.0},
                {"HEATER", "Ballu Classic 9", "Ballu", 2000, 220, "C", 11.0, 20.0, 5.0},
                {"FAN", "AEG Retro VL", "AEG", 45, 220, "A", 3.0, 10.0, 5.0},
                {"LAMP", "Philips LED E27", "Philips", 10, 220, "A++", 0.05, 806.0, 6.0},
        };
        for (Object[] c : catalog) {
            ContentValues v = new ContentValues();
            v.put("type", (String) c[0]);
            v.put("name", (String) c[1]);
            v.put("brand", (String) c[2]);
            v.put("power", (Integer) c[3]);
            v.put("voltage", (Integer) c[4]);
            v.put("energy_class", (String) c[5]);
            v.put("weight", ((Number) c[6]).doubleValue());
            v.put("extra", ((Number) c[7]).doubleValue());
            v.put("hours", ((Number) c[8]).doubleValue());
            db.insert("catalog", null, v);
        }

        long now = System.currentTimeMillis();
        long admin = insertUser(db, "admin", "Әкімші Ерлан", "admin@electroui.kz", "Admin123!", User.ADMIN, now);
        createDefaultRooms(db, admin);
        long aru = insertUser(db, "aru", "Ару Серікқызы", "aru@mail.kz", "Aru12345!", User.CLIENT, now);
        long[] rooms = createDefaultRooms(db, aru);

        // Демо пәтер: {каталогтағы жол, бөлме индексі, розеткада ма}
        int[][] demo = {
                {0, 0, 1}, {1, 0, 1}, {2, 0, 0},
                {6, 1, 1}, {8, 1, 0}, {11, 1, 1}, {7, 1, 0}, {4, 1, 0},
                {9, 2, 0}, {10, 2, 0}, {11, 2, 0},
                {3, 3, 0}, {5, 3, 0},
        };
        for (int[] d : demo) {
            Object[] c = catalog[d[0]];
            ContentValues v = new ContentValues();
            v.put("user_id", aru);
            v.put("room_id", rooms[d[1]]);
            v.put("type", (String) c[0]);
            v.put("name", d[0] == 11 && d[1] == 2 ? "Түнгі шам" : (String) c[1]);
            v.put("brand", (String) c[2]);
            v.put("power", (Integer) c[3]);
            v.put("voltage", (Integer) c[4]);
            v.put("energy_class", (String) c[5]);
            v.put("weight", ((Number) c[6]).doubleValue());
            v.put("extra", ((Number) c[7]).doubleValue());
            v.put("hours", ((Number) c[8]).doubleValue());
            v.put("plugged", d[2]);
            v.put("created_at", now);
            db.insert("appliances", null, v);
            if (d[2] == 1) {
                ContentValues e = new ContentValues();
                e.put("user_id", aru);
                e.put("appliance_name", (String) c[1]);
                e.put("action", "PLUG");
                e.put("power", (Integer) c[3]);
                e.put("at", now - 60_000L * (13 - d[0]));
                db.insert("events", null, e);
            }
        }

        notification(db, aru, "ЭлектроҮй-ге қош келдіңіз!",
                "Пәтеріңізде 13 құрал бар, оның 4-уі розеткаға қосулы. «Менің пәтерім» бөлімінен басқарыңыз.",
                "SUCCESS", now - 3_600_000L);
        notification(db, aru, "Әкімшіден хабарлама",
                "Электр тарифі: 1 кВт·сағ = 25 ₸. Айлық есеп осы тариф бойынша шығарылады.",
                "ADMIN", now - 1_800_000L);
        notification(db, admin, "Жүйе іске қосылды",
                "Дерекқор құрылды: 2 пайдаланушы, каталогта 12 құрал.", "INFO", now);
    }

    static long insertUser(SQLiteDatabase db, String login, String fullName, String email, String password,
                           String role, long createdAt) {
        String salt = PasswordHasher.newSalt();
        ContentValues v = new ContentValues();
        v.put("login", login);
        v.put("full_name", fullName);
        v.put("email", email);
        v.put("salt", salt);
        v.put("password_hash", PasswordHasher.hash(password, salt));
        v.put("role", role);
        v.put("blocked", 0);
        v.put("created_at", createdAt);
        return db.insertOrThrow("users", null, v);
    }

    static long[] createDefaultRooms(SQLiteDatabase db, long userId) {
        long[] ids = new long[DEFAULT_ROOMS.length];
        for (int i = 0; i < DEFAULT_ROOMS.length; i++) {
            ContentValues v = new ContentValues();
            v.put("user_id", userId);
            v.put("name", DEFAULT_ROOMS[i]);
            v.put("sockets", DEFAULT_SOCKETS[i]);
            ids[i] = db.insert("rooms", null, v);
        }
        return ids;
    }

    static void notification(SQLiteDatabase db, long userId, String title, String body, String kind, long at) {
        ContentValues v = new ContentValues();
        v.put("user_id", userId);
        v.put("title", title);
        v.put("body", body);
        v.put("kind", kind);
        v.put("is_read", 0);
        v.put("created_at", at);
        db.insert("notifications", null, v);
    }

    private static void setting(SQLiteDatabase db, String key, String value) {
        ContentValues v = new ContentValues();
        v.put("key", key);
        v.put("value", value);
        db.insertWithOnConflict("settings", null, v, SQLiteDatabase.CONFLICT_REPLACE);
    }
}
