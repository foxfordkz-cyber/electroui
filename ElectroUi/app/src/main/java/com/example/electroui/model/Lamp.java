package com.example.electroui.model;

/** 3-деңгей: шам. */
public class Lamp extends LightingAppliance {
    @Override public ApplianceType type() { return ApplianceType.LAMP; }
    @Override public String typeName() { return "Шам"; }
    @Override public double defaultHours() { return 6; }

    /** Жарық тиімділігі, лм/Вт. */
    public double efficiency() {
        return getPower() == 0 ? 0 : getExtra() / getPower();
    }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "»: " + number(getExtra()) + " лм, тиімділігі "
                + Math.round(efficiency()) + " лм/Вт.";
    }
}
