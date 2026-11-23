package com.example.electroui.model;

/** Розеткаға қосу / ажырату әрекетінің нәтижесі. */
public class PlugResult {
    public final boolean ok;
    public final boolean plugged;
    public final String message;
    public final boolean apartmentOverload;
    public final boolean roomOverload;
    public final int totalPower;
    public final int roomPower;

    public PlugResult(boolean ok, boolean plugged, String message, boolean apartmentOverload,
                      boolean roomOverload, int totalPower, int roomPower) {
        this.ok = ok;
        this.plugged = plugged;
        this.message = message;
        this.apartmentOverload = apartmentOverload;
        this.roomOverload = roomOverload;
        this.totalPower = totalPower;
        this.roomPower = roomPower;
    }

    public static PlugResult fail(String message) {
        return new PlugResult(false, false, message, false, false, 0, 0);
    }
}
