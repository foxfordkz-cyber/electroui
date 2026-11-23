package com.example.electroui.model;

/** 3-деңгей: желдеткіш. */
public class Fan extends ClimateAppliance {
    @Override public ApplianceType type() { return ApplianceType.FAN; }
    @Override public String typeName() { return "Желдеткіш"; }
    @Override public double defaultHours() { return 5; }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "» небәрі " + getPower()
                + " Вт тұтынады — кондиционерден әлдеқайда үнемді.";
    }
}
