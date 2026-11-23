package com.example.electroui.model;

/** 3-деңгей: үтік. Тұрмыстық техника + қыздырғыш элементі бар. */
public class Iron extends HouseholdAppliance implements Heating {
    @Override public ApplianceType type() { return ApplianceType.IRON; }
    @Override public String typeName() { return "Үтік"; }
    @Override public String extraLabel() { return "Су ыдысы"; }
    @Override public String extraUnit() { return "мл"; }
    @Override public double defaultHours() { return 0.3; }
    @Override public int maxTemperature() { return 220; }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "» табаны " + maxTemperature() + " °C-қа дейін қызады, бу үшін "
                + number(getExtra()) + " мл су құйылады.";
    }
}
