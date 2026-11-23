package com.example.electroui.model;

/** 3-деңгей: майлы жылытқыш. Климаттық техника + қыздырғыш элементі бар. */
public class Heater extends ClimateAppliance implements Heating {
    @Override public ApplianceType type() { return ApplianceType.HEATER; }
    @Override public String typeName() { return "Майлы жылытқыш"; }
    @Override public double defaultHours() { return 5; }
    @Override public int maxTemperature() { return 90; }

    /** «1 м² — 100 Вт» ережесі бойынша жылытатын аудан. */
    public double heatsArea() {
        return getPower() / 100.0;
    }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "» " + getPower() + " Вт қуатпен ~" + number(heatsArea())
                + " м² бөлмені жылытады (1 м² ≈ 100 Вт).";
    }
}
