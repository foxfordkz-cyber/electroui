package com.example.electroui.model;

/** 3-деңгей: тоңазытқыш. */
public class Refrigerator extends KitchenAppliance {
    @Override public ApplianceType type() { return ApplianceType.FRIDGE; }
    @Override public String typeName() { return "Тоңазытқыш"; }
    @Override public double defaultHours() { return 8; }

    /** Тоңазытқыш тәулік бойы розеткада тұрады. */
    public boolean isAlwaysOn() {
        return true;
    }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "» тәулік бойы розеткада тұрады, компрессоры тәулігіне ~"
                + number(getHoursPerDay()) + " сағат жұмыс істейді. Көлемі " + number(getExtra()) + " л.";
    }
}
