package com.example.electroui.model;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Берілген параметрлер диапазоны: қуат, кернеу, салмақ, жұмыс уақыты.
 * Бір критерий екі тәсілмен қолданылады: SQL сұранысы (BETWEEN) және Java-дағы matches().
 */
public class SearchCriteria {
    public static final int POWER_MAX = 3000;
    public static final int VOLTAGE_MAX = 240;
    public static final int WEIGHT_MAX = 80;
    public static final int HOURS_MAX = 24;

    public int minPower = 0;
    public int maxPower = POWER_MAX;
    public int minVoltage = 0;
    public int maxVoltage = VOLTAGE_MAX;
    public double minWeight = 0;
    public double maxWeight = WEIGHT_MAX;
    public double minHours = 0;
    public double maxHours = HOURS_MAX;
    public final Set<String> energyClasses = new LinkedHashSet<>();
    public Category category;
    public long roomId;
    public boolean pluggedOnly;
    public String text = "";

    /** Java тәсілі: құрал барлық шартқа сай ма? */
    public boolean matches(ElectricAppliance a) {
        if (a.getPower() < minPower || a.getPower() > maxPower) return false;
        if (a.getVoltage() < minVoltage || a.getVoltage() > maxVoltage) return false;
        if (a.getWeight() < minWeight || a.getWeight() > maxWeight) return false;
        if (a.getHoursPerDay() < minHours || a.getHoursPerDay() > maxHours) return false;
        if (!energyClasses.isEmpty() && !energyClasses.contains(a.getEnergyClass())) return false;
        if (category != null && a.category() != category) return false;
        if (roomId != 0 && a.getRoomId() != roomId) return false;
        if (pluggedOnly && !a.isPluggedIn()) return false;
        if (!text.trim().isEmpty()) {
            String q = text.trim().toLowerCase(Locale.ROOT);
            return a.getName().toLowerCase(Locale.ROOT).contains(q)
                    || a.getBrand().toLowerCase(Locale.ROOT).contains(q)
                    || a.typeName().toLowerCase(Locale.ROOT).contains(q);
        }
        return true;
    }

    /** SQL тәсілі: WHERE бөлігін құрастырады, мәндер args тізіміне түседі (SQL-инъекциядан қорғау). */
    public String where(long userId, List<String> args) {
        StringBuilder sb = new StringBuilder("a.user_id = ?");
        args.add(String.valueOf(userId));
        sb.append("\n  AND a.power BETWEEN ? AND ?");
        args.add(String.valueOf(minPower));
        // сырғытпа шетіне жетсе — «шексіз» (форманың өзі 10 000 Вт, 400 В, 500 кг-нан артықты қабылдамайды)
        args.add(String.valueOf(maxPower >= POWER_MAX ? 10000 : maxPower));
        sb.append("\n  AND a.voltage BETWEEN ? AND ?");
        args.add(String.valueOf(minVoltage));
        args.add(String.valueOf(maxVoltage >= VOLTAGE_MAX ? 400 : maxVoltage));
        sb.append("\n  AND a.weight BETWEEN ? AND ?");
        args.add(num(minWeight));
        args.add(maxWeight >= WEIGHT_MAX ? "500.00" : num(maxWeight));
        sb.append("\n  AND a.hours BETWEEN ? AND ?");
        args.add(num(minHours));
        args.add(num(maxHours));
        if (!energyClasses.isEmpty()) {
            sb.append("\n  AND a.energy_class IN (");
            int i = 0;
            for (String c : energyClasses) {
                sb.append(i++ == 0 ? "?" : ", ?");
                args.add(c);
            }
            sb.append(")");
        }
        if (category != null) {
            sb.append("\n  AND a.type IN (");
            int i = 0;
            for (ApplianceType t : ApplianceType.of(category)) {
                sb.append(i++ == 0 ? "?" : ", ?");
                args.add(t.name());
            }
            sb.append(")");
        }
        if (roomId != 0) {
            sb.append("\n  AND a.room_id = ?");
            args.add(String.valueOf(roomId));
        }
        if (pluggedOnly) sb.append("\n  AND a.plugged = 1");
        if (!text.trim().isEmpty()) {
            sb.append("\n  AND (a.name LIKE ? OR a.brand LIKE ?)");
            args.add("%" + text.trim() + "%");
            args.add("%" + text.trim() + "%");
        }
        return sb.toString();
    }

    /** Экранда көрсету үшін «?» орнына мәндерді қояды. */
    public static String display(String sql, List<String> args) {
        StringBuilder out = new StringBuilder();
        int arg = 0;
        for (int i = 0; i < sql.length(); i++) {
            char ch = sql.charAt(i);
            if (ch == '?' && arg < args.size()) {
                String v = args.get(arg++);
                out.append(v.matches("-?\\d+(\\.\\d+)?") ? v : "'" + v + "'");
            } else {
                out.append(ch);
            }
        }
        return out.toString();
    }

    private static String num(double v) {
        return String.format(Locale.US, "%.2f", v);
    }
}
