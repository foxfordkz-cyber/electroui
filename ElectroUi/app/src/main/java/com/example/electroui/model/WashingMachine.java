package com.example.electroui.model;

/** 3-деңгей: кір жуғыш машина. */
public class WashingMachine extends HouseholdAppliance {
    @Override public ApplianceType type() { return ApplianceType.WASHER; }
    @Override public String typeName() { return "Кір жуғыш машина"; }
    @Override public String extraLabel() { return "Жүктемесі"; }
    @Override public String extraUnit() { return "кг"; }
    @Override public double defaultHours() { return 1; }

    /** Бір жуу циклі (~1,5 сағат) жұмсайтын энергия, кВт·сағ. */
    public double cycleKwh() {
        return getPower() * 1.5 / 1000.0;
    }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "» бір рет " + number(getExtra()) + " кг кір жуады; бір цикл ≈ "
                + dec(cycleKwh(), 1) + " кВт·сағ.";
    }
}
