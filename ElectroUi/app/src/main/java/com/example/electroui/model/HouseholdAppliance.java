package com.example.electroui.model;

/** 2-деңгей: тұрмыстық (тазалау, кір жуу) техника. */
public abstract class HouseholdAppliance extends ElectricAppliance {
    @Override
    public final Category category() {
        return Category.HOUSEHOLD;
    }
}
