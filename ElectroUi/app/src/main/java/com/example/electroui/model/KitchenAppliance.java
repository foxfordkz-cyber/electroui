package com.example.electroui.model;

/** 2-деңгей: ас үй техникасы. Барлығының қосымша параметрі — көлем (л). */
public abstract class KitchenAppliance extends ElectricAppliance {
    @Override
    public final Category category() {
        return Category.KITCHEN;
    }

    @Override
    public String extraLabel() {
        return "Көлемі";
    }

    @Override
    public String extraUnit() {
        return "л";
    }
}
