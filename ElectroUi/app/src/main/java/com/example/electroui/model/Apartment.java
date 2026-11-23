package com.example.electroui.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Пәтер: бөлмелер мен құралдар жиыны.
 * Тапсырманың негізгі әрекеттері осы класта: розеткаға қосу, қуатты есептеу, сұрыптау, іздеу.
 */
public class Apartment {
    public static final int DEFAULT_VOLTAGE = 220;

    private final List<Room> rooms;
    private final List<ElectricAppliance> appliances;

    public Apartment(List<Room> rooms, List<ElectricAppliance> appliances) {
        this.rooms = new ArrayList<>(rooms);
        this.appliances = new ArrayList<>(appliances);
    }

    public List<Room> getRooms() {
        return Collections.unmodifiableList(rooms);
    }

    public List<ElectricAppliance> getAppliances() {
        return Collections.unmodifiableList(appliances);
    }

    public Room room(long id) {
        for (Room r : rooms) if (r.getId() == id) return r;
        return null;
    }

    public ElectricAppliance find(long applianceId) {
        for (ElectricAppliance a : appliances) if (a.getId() == applianceId) return a;
        return null;
    }

    // ---------- 2. Розеткаға қосу ----------
    public int usedSockets(long roomId) {
        int n = 0;
        for (ElectricAppliance a : appliances) if (a.getRoomId() == roomId && a.isPluggedIn()) n++;
        return n;
    }

    public int freeSockets(long roomId) {
        Room r = room(roomId);
        return r == null ? 0 : Math.max(0, r.getSockets() - usedSockets(roomId));
    }

    public int totalSockets() {
        int n = 0;
        for (Room r : rooms) n += r.getSockets();
        return n;
    }

    /** Бос розетка болса ғана қосуға болады. */
    public boolean canPlug(ElectricAppliance a) {
        return a.isPluggedIn() || freeSockets(a.getRoomId()) > 0;
    }

    public List<ElectricAppliance> plugged() {
        List<ElectricAppliance> list = new ArrayList<>();
        for (ElectricAppliance a : appliances) if (a.isPluggedIn()) list.add(a);
        return list;
    }

    public List<ElectricAppliance> inRoom(long roomId) {
        List<ElectricAppliance> list = new ArrayList<>();
        for (ElectricAppliance a : appliances) if (a.getRoomId() == roomId) list.add(a);
        return list;
    }

    // ---------- 3. Тұтынылатын қуатты есептеу ----------
    /** P = ΣPᵢ — тек розеткаға қосылған құралдар. */
    public int pluggedPower() {
        int sum = 0;
        for (ElectricAppliance a : appliances) if (a.isPluggedIn()) sum += a.getPower();
        return sum;
    }

    /** Пәтердегі барлық құралдардың қуаты (қосулы-қосылмағанына қарамай). */
    public int installedPower() {
        int sum = 0;
        for (ElectricAppliance a : appliances) sum += a.getPower();
        return sum;
    }

    /** I = P / U, ампер. */
    public double pluggedCurrent() {
        return pluggedPower() / (double) DEFAULT_VOLTAGE;
    }

    /** E = Σ(Pᵢ·tᵢ) / 1000, кВт·сағ (тәулігіне). */
    public double dailyKwh() {
        double sum = 0;
        for (ElectricAppliance a : appliances) if (a.isPluggedIn()) sum += a.dailyKwh();
        return sum;
    }

    public double monthlyKwh() {
        return dailyKwh() * 30;
    }

    public double monthlyCost(double tariff) {
        return monthlyKwh() * tariff;
    }

    public int roomPower(long roomId) {
        int sum = 0;
        for (ElectricAppliance a : appliances)
            if (a.getRoomId() == roomId && a.isPluggedIn()) sum += a.getPower();
        return sum;
    }

    public Map<Category, Integer> powerByCategory() {
        Map<Category, Integer> map = new EnumMap<>(Category.class);
        for (Category c : Category.values()) map.put(c, 0);
        for (ElectricAppliance a : appliances)
            if (a.isPluggedIn()) map.put(a.category(), map.get(a.category()) + a.getPower());
        return map;
    }

    // ---------- 4. Қуат бойынша сұрыптау ----------
    public List<ElectricAppliance> sortByPower(boolean ascending) {
        return sort(ascending ? SortMode.POWER_ASC : SortMode.POWER_DESC);
    }

    public List<ElectricAppliance> sort(SortMode mode) {
        List<ElectricAppliance> copy = new ArrayList<>(appliances);
        copy.sort(mode.comparator());
        return copy;
    }

    // ---------- 5. Параметрлер диапазоны бойынша іздеу ----------
    public List<ElectricAppliance> find(SearchCriteria criteria) {
        List<ElectricAppliance> list = new ArrayList<>();
        for (ElectricAppliance a : appliances) if (criteria.matches(a)) list.add(a);
        return list;
    }

    public ElectricAppliance mostPowerful() {
        ElectricAppliance best = null;
        for (ElectricAppliance a : appliances) if (best == null || a.getPower() > best.getPower()) best = a;
        return best;
    }
}
