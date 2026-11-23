package com.example.electroui.model;

/** Иерархияның екінші деңгейі — құралдардың санаттары. */
public enum Category {
    KITCHEN("Ас үй техникасы", "KitchenAppliance", 0xFFFF8A3D),
    HOUSEHOLD("Тұрмыстық техника", "HouseholdAppliance", 0xFF3D8BFF),
    MULTIMEDIA("Мультимедиа техникасы", "MultimediaAppliance", 0xFF9C6CFF),
    CLIMATE("Климаттық техника", "ClimateAppliance", 0xFF1FBF9F),
    LIGHTING("Жарықтандыру", "LightingAppliance", 0xFFF5B82E);

    public final String title;
    public final String className;
    public final int color;

    Category(String title, String className, int color) {
        this.title = title;
        this.className = className;
        this.color = color;
    }
}
