package com.example.electroui.model;

/** Қыздырғыш элементі бар құралдар: шәйнек, үтік, жылытқыш. */
public interface Heating {
    /** Қыздырудың ең жоғары температурасы, °C. */
    int maxTemperature();

    default String heatingInfo() {
        return "Қыздыру элементі: " + maxTemperature() + " °C-қа дейін";
    }
}
