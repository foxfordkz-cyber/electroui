package com.example.electroui.util;

import com.example.electroui.R;
import com.example.electroui.model.ApplianceType;

/** Құрал түрі → суреті. Суреттер Wikimedia Commons-тан алынған (IMAGE_SOURCES.txt). */
public final class Images {
    private Images() {
    }

    public static int forType(ApplianceType t) {
        switch (t) {
            case KETTLE: return R.drawable.img_kettle;
            case FRIDGE: return R.drawable.img_fridge;
            case MICROWAVE: return R.drawable.img_microwave;
            case WASHER: return R.drawable.img_washer;
            case VACUUM: return R.drawable.img_vacuum;
            case IRON: return R.drawable.img_iron;
            case TV: return R.drawable.img_tv;
            case COMPUTER: return R.drawable.img_computer;
            case AIRCON: return R.drawable.img_aircon;
            case HEATER: return R.drawable.img_heater;
            case FAN: return R.drawable.img_fan;
            default: return R.drawable.img_lamp;
        }
    }
}
