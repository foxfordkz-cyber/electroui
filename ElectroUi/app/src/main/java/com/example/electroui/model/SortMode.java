package com.example.electroui.model;

import java.text.Collator;
import java.util.Comparator;
import java.util.Locale;

/** Сұрыптау тәсілдері. Негізгісі — қуат бойынша. */
public enum SortMode {
    POWER_ASC("Қуаты ↑", "Comparator.comparingInt(ElectricAppliance::getPower)"),
    POWER_DESC("Қуаты ↓", "Comparator.comparingInt(ElectricAppliance::getPower).reversed()"),
    DAILY("Тәулік, кВт·сағ ↓", "Comparator.comparingDouble(ElectricAppliance::dailyKwh).reversed()"),
    ENERGY("Энергия класы", "Comparator.comparingInt(ElectricAppliance::energyRank)"),
    NAME("Атауы А→Я", "Comparator.comparing(ElectricAppliance::getName, collator)"),
    WEIGHT("Салмағы ↑", "Comparator.comparingDouble(ElectricAppliance::getWeight)");

    public final String title;
    public final String code;

    SortMode(String title, String code) {
        this.title = title;
        this.code = code;
    }

    public Comparator<ElectricAppliance> comparator() {
        switch (this) {
            case POWER_ASC:
                return Comparator.comparingInt(ElectricAppliance::getPower);
            case POWER_DESC:
                return Comparator.comparingInt(ElectricAppliance::getPower).reversed();
            case DAILY:
                return Comparator.comparingDouble(ElectricAppliance::dailyKwh).reversed();
            case ENERGY:
                return Comparator.comparingInt(ElectricAppliance::energyRank)
                        .thenComparingInt(ElectricAppliance::getPower);
            case NAME:
                Collator collator = Collator.getInstance(Locale.forLanguageTag("kk-KZ"));
                return Comparator.comparing(ElectricAppliance::getName, collator);
            default:
                return Comparator.comparingDouble(ElectricAppliance::getWeight);
        }
    }
}
