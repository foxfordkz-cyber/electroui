package com.example.electroui.model;

/** 3-деңгей: компьютер. */
public class Computer extends MultimediaAppliance {
    @Override public ApplianceType type() { return ApplianceType.COMPUTER; }
    @Override public String typeName() { return "Компьютер"; }
    @Override public String extraLabel() { return "Жедел жады"; }
    @Override public String extraUnit() { return "ГБ"; }
    @Override public double defaultHours() { return 6; }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "»: " + number(getExtra()) + " ГБ жедел жады, қуат блогы "
                + getPower() + " Вт.";
    }
}
