package com.example.electroui.model;

/** 2-деңгей: жарықтандыру құралдары. */
public abstract class LightingAppliance extends ElectricAppliance {
    @Override
    public final Category category() {
        return Category.LIGHTING;
    }

    @Override
    public String extraLabel() {
        return "Жарық ағыны";
    }

    @Override
    public String extraUnit() {
        return "лм";
    }
}
