package com.example.electroui.model;

/** 3-деңгей: микротолқынды пеш. */
public class Microwave extends KitchenAppliance {
    @Override public ApplianceType type() { return ApplianceType.MICROWAVE; }
    @Override public String typeName() { return "Микротолқынды пеш"; }
    @Override public double defaultHours() { return 0.3; }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "» " + number(getExtra())
                + " л камерасы бар, тағамды жылыту кезінде " + getPower() + " Вт тұтынады.";
    }
}
