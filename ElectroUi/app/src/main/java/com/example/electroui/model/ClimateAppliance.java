package com.example.electroui.model;

/** 2-деңгей: климаттық техника. Қосымша параметрі — бөлменің ауданы (м²). */
public abstract class ClimateAppliance extends ElectricAppliance {
    @Override
    public final Category category() {
        return Category.CLIMATE;
    }

    @Override
    public String extraLabel() {
        return "Аудан";
    }

    @Override
    public String extraUnit() {
        return "м²";
    }
}
