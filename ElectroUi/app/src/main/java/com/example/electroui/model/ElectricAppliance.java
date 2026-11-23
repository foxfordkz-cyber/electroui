package com.example.electroui.model;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Иерархияның түбірі — «Электр құралы».
 * Барлық құралдарға ортақ өрістер мен есептеулер осы абстракт класта.
 */
public abstract class ElectricAppliance implements Pluggable {
    public static final List<String> ENERGY_CLASSES =
            Collections.unmodifiableList(Arrays.asList("A+++", "A++", "A+", "A", "B", "C", "D"));

    private long id;
    private String name = "";
    private String brand = "";
    private int power;            // Вт
    private int voltage = 220;    // В
    private String energyClass = "A";
    private double weight;        // кг
    private double extra;         // түрге тән параметр (көлем, диагональ, аудан...)
    private double hoursPerDay;   // тәулігіне неше сағат жұмыс істейді
    private boolean pluggedIn;
    private long roomId;
    private String roomName = "";

    protected ElectricAppliance() {
        hoursPerDay = defaultHours();
    }

    // ---- Әр нақты класс өзі анықтайтын әдістер (полиморфизм) ----
    public abstract ApplianceType type();

    public abstract String typeName();

    public abstract Category category();

    public abstract String extraLabel();

    public abstract String extraUnit();

    public abstract double defaultHours();

    /** Құралдың өз сипаттамасы — әр класс бұл әдісті өзгертеді. */
    public String describe() {
        return typeName() + " «" + name + "» " + power + " Вт қуат тұтынады.";
    }

    // ---- Pluggable ----
    @Override
    public void plugIn() {
        pluggedIn = true;
    }

    @Override
    public void unplug() {
        pluggedIn = false;
    }

    @Override
    public boolean isPluggedIn() {
        return pluggedIn;
    }

    // ---- Физикалық есептеулер ----
    /** Ток күші I = P / U, ампер. */
    public double current() {
        return voltage <= 0 ? 0 : (double) power / voltage;
    }

    /** Тәулігіне жұмсалатын энергия E = P·t / 1000, кВт·сағ. */
    public double dailyKwh() {
        return power * hoursPerDay / 1000.0;
    }

    public double monthlyKwh() {
        return dailyKwh() * 30;
    }

    public double monthlyCost(double tariff) {
        return monthlyKwh() * tariff;
    }

    /** Энергия класының реттік нөмірі: A+++ = 0 (ең үнемді) ... D = 6. */
    public int energyRank() {
        int i = ENERGY_CLASSES.indexOf(energyClass);
        return i < 0 ? ENERGY_CLASSES.size() : i;
    }

    /** Класс тізбегі: ElectricAppliance → KitchenAppliance → Kettle. */
    public List<String> hierarchyPath() {
        List<String> path = new ArrayList<>();
        Class<?> c = getClass();
        while (c != null && ElectricAppliance.class.isAssignableFrom(c)) {
            path.add(0, c.getSimpleName());
            c = c.getSuperclass();
        }
        return path;
    }

    public String extraText() {
        return extraLabel() + ": " + number(extra) + " " + extraUnit();
    }

    protected static String number(double v) {
        if (v == Math.rint(v)) return String.valueOf((long) v);
        return String.format(Locale.US, "%.2f", v).replaceAll("0+$", "").replace('.', ',');
    }

    /** Ондық бөлшекті үтірмен жазу: dec(4.13, 1) → "4,1". */
    protected static String dec(double v, int digits) {
        return String.format(Locale.US, "%." + digits + "f", v).replace('.', ',');
    }

    // ---- Getter / Setter ----
    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name == null ? "" : name.trim(); }
    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand == null ? "" : brand.trim(); }
    public int getPower() { return power; }

    public void setPower(int power) {
        if (power <= 0) throw new IllegalArgumentException("Қуат 0-ден үлкен болуы керек");
        this.power = power;
    }

    public int getVoltage() { return voltage; }

    public void setVoltage(int voltage) {
        if (voltage <= 0) throw new IllegalArgumentException("Кернеу 0-ден үлкен болуы керек");
        this.voltage = voltage;
    }

    public String getEnergyClass() { return energyClass; }

    public void setEnergyClass(String energyClass) {
        this.energyClass = ENERGY_CLASSES.contains(energyClass) ? energyClass : "A";
    }

    public double getWeight() { return weight; }
    public void setWeight(double weight) { this.weight = Math.max(0, weight); }
    public double getExtra() { return extra; }
    public void setExtra(double extra) { this.extra = Math.max(0, extra); }
    public double getHoursPerDay() { return hoursPerDay; }
    public void setHoursPerDay(double h) { this.hoursPerDay = Math.max(0, Math.min(24, h)); }
    public void setPluggedIn(boolean plugged) { if (plugged) plugIn(); else unplug(); }
    public long getRoomId() { return roomId; }
    public void setRoomId(long roomId) { this.roomId = roomId; }
    public String getRoomName() { return roomName; }
    public void setRoomName(String roomName) { this.roomName = roomName == null ? "" : roomName; }

    @Override
    public String toString() {
        return typeName() + " " + name + " (" + power + " Вт)";
    }
}
