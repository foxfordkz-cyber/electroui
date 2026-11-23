package com.example.electroui.model;

/** 2-деңгей: мультимедиа техникасы. */
public abstract class MultimediaAppliance extends ElectricAppliance {
    @Override
    public final Category category() {
        return Category.MULTIMEDIA;
    }
}
