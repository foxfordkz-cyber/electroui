package com.example.electroui.data;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import com.example.electroui.model.Apartment;
import com.example.electroui.model.ApplianceType;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.model.PlugResult;
import com.example.electroui.model.Room;
import com.example.electroui.model.SearchCriteria;

import java.util.ArrayList;
import java.util.List;

/** Құралдар, бөлмелер және каталог бойынша SQL-операциялар. */
public class ApplianceRepository {
    public static final String SELECT =
            "SELECT a.id, a.type, a.name, a.brand, a.power, a.voltage, a.energy_class, a.weight, a.extra, a.hours, " +
                    "a.plugged, a.room_id, r.name AS room_name\nFROM appliances a\nJOIN rooms r ON r.id = a.room_id";

    private final DbHelper db;
    private final SettingsRepository settings;

    public ApplianceRepository(Context context) {
        db = DbHelper.get(context);
        settings = new SettingsRepository(context);
    }

    // ------------------------------------------------------------------ пәтер
    public Apartment load(long userId) {
        return new Apartment(rooms(userId), list(userId));
    }

    public List<Room> rooms(long userId) {
        List<Room> rooms = new ArrayList<>();
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT id, name, sockets FROM rooms WHERE user_id = ? ORDER BY id",
                new String[]{String.valueOf(userId)})) {
            while (c.moveToNext()) rooms.add(new Room(c.getLong(0), c.getString(1), c.getInt(2)));
        }
        return rooms;
    }

    public List<ElectricAppliance> list(long userId) {
        return query(SELECT + "\nWHERE a.user_id = ?\nORDER BY a.room_id, a.id", new String[]{String.valueOf(userId)});
    }

    public ElectricAppliance get(long id) {
        List<ElectricAppliance> list = query(SELECT + " WHERE a.id = ?", new String[]{String.valueOf(id)});
        return list.isEmpty() ? null : list.get(0);
    }

    private List<ElectricAppliance> query(String sql, String[] args) {
        List<ElectricAppliance> list = new ArrayList<>();
        try (Cursor c = db.getReadableDatabase().rawQuery(sql, args)) {
            while (c.moveToNext()) {
                ElectricAppliance a = fromCursor(c);
                a.setPluggedIn(c.getInt(10) == 1);
                a.setRoomId(c.getLong(11));
                a.setRoomName(c.getString(12));
                list.add(a);
            }
        }
        return list;
    }

    /** Жолдың «type» бағанасы бойынша нақты класс жасалады — полиморфизм осында басталады. */
    private static ElectricAppliance fromCursor(Cursor c) {
        ElectricAppliance a = ApplianceType.of(c.getString(1)).create();
        a.setId(c.getLong(0));
        a.setName(c.getString(2));
        a.setBrand(c.getString(3));
        a.setPower(c.getInt(4));
        a.setVoltage(c.getInt(5));
        a.setEnergyClass(c.getString(6));
        a.setWeight(c.getDouble(7));
        a.setExtra(c.getDouble(8));
        a.setHoursPerDay(c.getDouble(9));
        return a;
    }

    private static ContentValues values(ElectricAppliance a) {
        ContentValues v = new ContentValues();
        v.put("type", a.type().name());
        v.put("name", a.getName());
        v.put("brand", a.getBrand());
        v.put("power", a.getPower());
        v.put("voltage", a.getVoltage());
        v.put("energy_class", a.getEnergyClass());
        v.put("weight", a.getWeight());
        v.put("extra", a.getExtra());
        v.put("hours", a.getHoursPerDay());
        return v;
    }

    public long add(long userId, ElectricAppliance a) {
        ContentValues v = values(a);
        v.put("user_id", userId);
        v.put("room_id", a.getRoomId());
        v.put("plugged", 0);
        v.put("created_at", System.currentTimeMillis());
        long id = db.getWritableDatabase().insertOrThrow("appliances", null, v);
        log(userId, a.getName(), "ADD", a.getPower());
        return id;
    }

    public void update(ElectricAppliance a) {
        ContentValues v = values(a);
        v.put("room_id", a.getRoomId());
        db.getWritableDatabase().update("appliances", v, "id = ?", new String[]{String.valueOf(a.getId())});
    }

    public void delete(long userId, long id) {
        ElectricAppliance a = get(id);
        db.getWritableDatabase().delete("appliances", "id = ? AND user_id = ?",
                new String[]{String.valueOf(id), String.valueOf(userId)});
        if (a != null) log(userId, a.getName(), "DELETE", a.getPower());
    }

    // ------------------------------------------------------------------ розеткаға қосу
    public PlugResult setPlugged(long userId, long applianceId, boolean plug) {
        Apartment apartment = load(userId);
        ElectricAppliance a = apartment.find(applianceId);
        if (a == null) return PlugResult.fail("Құрал табылмады");
        if (plug && !a.isPluggedIn() && !apartment.canPlug(a)) {
            com.example.electroui.model.Room r = apartment.room(a.getRoomId());
            return PlugResult.fail("«" + (r == null ? "" : r.getName()) + "» бөлмесінде бос розетка жоқ ("
                    + apartment.usedSockets(a.getRoomId()) + "/" + (r == null ? 0 : r.getSockets()) + ")");
        }
        ContentValues v = new ContentValues();
        v.put("plugged", plug ? 1 : 0);
        db.getWritableDatabase().update("appliances", v, "id = ?", new String[]{String.valueOf(applianceId)});
        log(userId, a.getName(), plug ? "PLUG" : "UNPLUG", a.getPower());

        a.setPluggedIn(plug);
        int total = apartment.pluggedPower();
        int room = apartment.roomPower(a.getRoomId());
        boolean over = plug && total > settings.limit();
        boolean roomOver = plug && room > settings.roomLimit();
        String msg = (plug ? "Розеткаға қосылды: " : "Розеткадан ажыратылды: ") + a.getName();
        return new PlugResult(true, plug, msg, over, roomOver, total, room);
    }

    public int unplugAll(long userId) {
        ContentValues v = new ContentValues();
        v.put("plugged", 0);
        int n = db.getWritableDatabase().update("appliances", v, "user_id = ? AND plugged = 1",
                new String[]{String.valueOf(userId)});
        if (n > 0) log(userId, n + " құрал", "UNPLUG_ALL", 0);
        return n;
    }

    // ------------------------------------------------------------------ іздеу (SQL BETWEEN)
    /** sqlOut-қа экранда көрсетілетін SQL мәтіні жазылады. */
    public List<ElectricAppliance> search(long userId, SearchCriteria criteria, StringBuilder sqlOut) {
        List<String> args = new ArrayList<>();
        String sql = SELECT + "\nWHERE " + criteria.where(userId, args) + "\nORDER BY a.power DESC";
        if (sqlOut != null) sqlOut.append(SearchCriteria.display(sql, args));
        return query(sql, args.toArray(new String[0]));
    }

    // ------------------------------------------------------------------ тарих
    private void log(long userId, String name, String action, int power) {
        ContentValues v = new ContentValues();
        v.put("user_id", userId);
        v.put("appliance_name", name);
        v.put("action", action);
        v.put("power", power);
        v.put("at", System.currentTimeMillis());
        db.getWritableDatabase().insert("events", null, v);
    }

    /** Соңғы әрекеттер: {атауы, әрекет, қуаты, уақыты}. */
    public List<String[]> recentEvents(long userId, int limit) {
        List<String[]> list = new ArrayList<>();
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT appliance_name, action, power, at FROM events WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT " + limit,
                new String[]{String.valueOf(userId)})) {
            while (c.moveToNext())
                list.add(new String[]{c.getString(0), c.getString(1), c.getString(2), c.getString(3)});
        }
        return list;
    }

    // ------------------------------------------------------------------ каталог (әкімші басқарады)
    public List<ElectricAppliance> catalog() {
        List<ElectricAppliance> list = new ArrayList<>();
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT id, type, name, brand, power, voltage, energy_class, weight, extra, hours FROM catalog ORDER BY type, power",
                null)) {
            while (c.moveToNext()) list.add(fromCursor(c));
        }
        return list;
    }

    public ElectricAppliance catalogItem(long id) {
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT id, type, name, brand, power, voltage, energy_class, weight, extra, hours FROM catalog WHERE id = ?",
                new String[]{String.valueOf(id)})) {
            return c.moveToFirst() ? fromCursor(c) : null;
        }
    }

    public long addCatalog(ElectricAppliance a) {
        return db.getWritableDatabase().insertOrThrow("catalog", null, values(a));
    }

    public void updateCatalog(ElectricAppliance a) {
        db.getWritableDatabase().update("catalog", values(a), "id = ?", new String[]{String.valueOf(a.getId())});
    }

    public void deleteCatalog(long id) {
        db.getWritableDatabase().delete("catalog", "id = ?", new String[]{String.valueOf(id)});
    }

    public int count(String sql, String... args) {
        try (Cursor c = db.getReadableDatabase().rawQuery(sql, args)) {
            return c.moveToFirst() ? c.getInt(0) : 0;
        }
    }

    public SQLiteDatabase raw() {
        return db.getReadableDatabase();
    }
}
