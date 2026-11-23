package com.example.electroui.model;

import java.util.ArrayList;
import java.util.List;

/** Нақты кластардың тізімі және фабрика: дерекқордағы "KETTLE" → new Kettle(). */
public enum ApplianceType {
    KETTLE, FRIDGE, MICROWAVE, WASHER, VACUUM, IRON, TV, COMPUTER, AIRCON, HEATER, FAN, LAMP;

    private ElectricAppliance sample;

    /** Фабрикалық әдіс: түрдің кілтінен нақты класс нысанын жасайды. */
    public ElectricAppliance create() {
        switch (this) {
            case KETTLE: return new Kettle();
            case FRIDGE: return new Refrigerator();
            case MICROWAVE: return new Microwave();
            case WASHER: return new WashingMachine();
            case VACUUM: return new VacuumCleaner();
            case IRON: return new Iron();
            case TV: return new Television();
            case COMPUTER: return new Computer();
            case AIRCON: return new AirConditioner();
            case HEATER: return new Heater();
            case FAN: return new Fan();
            default: return new Lamp();
        }
    }

    /** Атауын, санатын білу үшін бір үлгі нысан. */
    public synchronized ElectricAppliance sample() {
        if (sample == null) sample = create();
        return sample;
    }

    public String title() {
        return sample().typeName();
    }

    public Category category() {
        return sample().category();
    }

    public static ApplianceType of(String key) {
        for (ApplianceType t : values()) if (t.name().equalsIgnoreCase(key)) return t;
        return LAMP;
    }

    public static List<ApplianceType> of(Category category) {
        List<ApplianceType> list = new ArrayList<>();
        for (ApplianceType t : values()) if (t.category() == category) list.add(t);
        return list;
    }
}
