package com.example.electroui.model;

/** 3-деңгей: кондиционер. */
public class AirConditioner extends ClimateAppliance {
    @Override public ApplianceType type() { return ApplianceType.AIRCON; }
    @Override public String typeName() { return "Кондиционер"; }
    @Override public double defaultHours() { return 6; }

    /** Салқындату қуаты: 10 м²-ге шамамен 1 кВт. */
    public double coolingKw() {
        return getExtra() / 10.0;
    }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "» " + number(getExtra()) + " м² бөлмені салқындатады (≈ "
                + dec(coolingKw(), 1) + " кВт суық), электрден " + getPower() + " Вт алады.";
    }
}
