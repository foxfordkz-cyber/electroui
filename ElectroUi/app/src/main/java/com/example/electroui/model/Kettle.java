package com.example.electroui.model;

/** 3-деңгей: электр шәйнек. Ас үй техникасы + қыздырғыш элементі бар. */
public class Kettle extends KitchenAppliance implements Heating {
    @Override public ApplianceType type() { return ApplianceType.KETTLE; }
    @Override public String typeName() { return "Электр шәйнек"; }
    @Override public double defaultHours() { return 0.5; }
    @Override public int maxTemperature() { return 100; }

    /** Суды 20 °C-тан 100 °C-қа дейін қайнату уақыты: t = m·c·ΔT / P (минут). */
    public double boilMinutes() {
        if (getPower() == 0) return 0;
        return getExtra() * 4186 * 80 / getPower() / 60.0;
    }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "»: " + number(getExtra()) + " л суды шамамен "
                + dec(boilMinutes(), 1) + " минутта қайнатады (" + getPower() + " Вт).";
    }
}
