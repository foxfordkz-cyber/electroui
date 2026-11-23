package com.example.electroui.data;

import android.content.Context;
import android.database.Cursor;

import java.util.ArrayList;
import java.util.List;

/** Әкімшіге арналған жиынтық SQL есептері: COUNT, SUM, AVG, GROUP BY, HAVING, JOIN, ішкі сұраныс. */
public class StatsRepository {
    public static class Report {
        public final String title;
        public final String sql;
        public final List<String> columns = new ArrayList<>();
        public final List<String[]> rows = new ArrayList<>();

        Report(String title, String sql) {
            this.title = title;
            this.sql = sql;
        }
    }

    public static final String[][] REPORTS = {
            {"1. COUNT, SUM, AVG, MIN, MAX — барлық құралдар",
                    "SELECT COUNT(*) AS \"саны\", SUM(power) AS \"жалпы, Вт\", ROUND(AVG(power)) AS \"орташа, Вт\",\n" +
                            "       MIN(power) AS \"min, Вт\", MAX(power) AS \"max, Вт\"\nFROM appliances"},
            {"2. GROUP BY — түрлері бойынша",
                    "SELECT type AS \"түрі\", COUNT(*) AS \"саны\", SUM(power) AS \"қуат, Вт\"\nFROM appliances\n" +
                            "GROUP BY type\nORDER BY \"қуат, Вт\" DESC"},
            {"3. LEFT JOIN + SUM(CASE) — клиенттердің қосулы қуаты",
                    "SELECT u.login AS \"логин\", COUNT(a.id) AS \"құрал\",\n" +
                            "       SUM(CASE WHEN a.plugged = 1 THEN a.power ELSE 0 END) AS \"қосулы, Вт\"\n" +
                            "FROM users u\nLEFT JOIN appliances a ON a.user_id = u.id\nWHERE u.role = 'CLIENT'\n" +
                            "GROUP BY u.id\nORDER BY \"қосулы, Вт\" DESC"},
            {"4. JOIN + HAVING — 2+ құрал қосулы бөлмелер",
                    "SELECT u.login AS \"логин\", r.name AS \"бөлме\", COUNT(*) AS \"қосулы\"\n" +
                            "FROM appliances a\nJOIN rooms r ON r.id = a.room_id\nJOIN users u ON u.id = a.user_id\n" +
                            "WHERE a.plugged = 1\nGROUP BY r.id\nHAVING COUNT(*) >= 2"},
            {"5. Ішкі сұраныс — орташадан қуатты құралдар",
                    "SELECT name AS \"атауы\", power AS \"Вт\"\nFROM appliances\n" +
                            "WHERE power > (SELECT AVG(power) FROM appliances)\nORDER BY power DESC"},
            {"6. BETWEEN — 1000…2500 Вт аралығы (каталог)",
                    "SELECT name AS \"атауы\", power AS \"Вт\"\nFROM catalog\nWHERE power BETWEEN 1000 AND 2500\nORDER BY power"},
            {"7. CASE — энергия санаты",
                    "SELECT name AS \"атауы\", energy_class AS \"класс\",\n" +
                            "       CASE WHEN energy_class LIKE 'A+%' THEN 'үнемді'\n" +
                            "            WHEN energy_class IN ('A','B') THEN 'орташа'\n" +
                            "            ELSE 'көп тұтынады' END AS \"бағасы\"\nFROM catalog\nORDER BY energy_class"},
            {"8. JOIN + datetime — соңғы 10 әрекет",
                    "SELECT u.login AS \"логин\", e.appliance_name AS \"құрал\", e.action AS \"әрекет\",\n" +
                            "       strftime('%d.%m %H:%M', e.at / 1000, 'unixepoch', 'localtime') AS \"уақыт\"\n" +
                            "FROM events e\nJOIN users u ON u.id = e.user_id\nORDER BY e.at DESC\nLIMIT 10"},
            {"9. GROUP BY — рөлдер",
                    "SELECT role AS \"рөл\", COUNT(*) AS \"саны\", SUM(blocked) AS \"бұғатталған\"\nFROM users\nGROUP BY role"},
    };

    private final DbHelper db;

    public StatsRepository(Context context) {
        db = DbHelper.get(context);
    }

    public List<Report> reports() {
        List<Report> list = new ArrayList<>();
        for (String[] r : REPORTS) list.add(run(r[0], r[1]));
        return list;
    }

    public Report run(String title, String sql) {
        Report report = new Report(title, sql);
        try (Cursor c = db.getReadableDatabase().rawQuery(sql, null)) {
            for (String name : c.getColumnNames()) report.columns.add(name);
            while (c.moveToNext()) {
                String[] row = new String[c.getColumnCount()];
                for (int i = 0; i < row.length; i++) row[i] = c.isNull(i) ? "—" : c.getString(i);
                report.rows.add(row);
            }
        }
        return report;
    }

    /** {пайдаланушылар, құралдар, қосулы, қосулы қуат Вт} — барлық жүйе бойынша. */
    public int[] totals() {
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT (SELECT COUNT(*) FROM users), COUNT(*), COALESCE(SUM(plugged), 0), " +
                        "COALESCE(SUM(CASE WHEN plugged = 1 THEN power ELSE 0 END), 0) FROM appliances", null)) {
            c.moveToFirst();
            return new int[]{c.getInt(0), c.getInt(1), c.getInt(2), c.getInt(3)};
        }
    }

    /** Түрлері бойынша қосулы қуат: {type, Вт}. */
    public List<String[]> powerByType() {
        List<String[]> list = new ArrayList<>();
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT type, SUM(power), COUNT(*) FROM appliances GROUP BY type ORDER BY SUM(power) DESC", null)) {
            while (c.moveToNext()) list.add(new String[]{c.getString(0), c.getString(1), c.getString(2)});
        }
        return list;
    }
}
