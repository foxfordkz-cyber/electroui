package com.example.electroui.model;

/** 3-деңгей: теледидар. */
public class Television extends MultimediaAppliance {
    @Override public ApplianceType type() { return ApplianceType.TV; }
    @Override public String typeName() { return "Теледидар"; }
    @Override public String extraLabel() { return "Диагоналы"; }
    @Override public String extraUnit() { return "дюйм"; }
    @Override public double defaultHours() { return 4; }

    public double diagonalCm() {
        return getExtra() * 2.54;
    }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "»: экраны " + number(getExtra()) + " дюйм ("
                + Math.round(diagonalCm()) + " см), " + getPower() + " Вт.";
    }
}
