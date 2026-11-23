package com.example.electroui.util;

import android.os.Handler;
import android.os.Looper;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** Деректер өзгергенін экрандарға хабарлау (мысалы, 3D көріністе құрал қосылса — бадж, басты бет жаңарады). */
public final class DataBus {
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final List<Runnable> LISTENERS = new CopyOnWriteArrayList<>();

    private DataBus() {
    }

    public static void register(Runnable r) {
        if (!LISTENERS.contains(r)) LISTENERS.add(r);
    }

    public static void unregister(Runnable r) {
        LISTENERS.remove(r);
    }

    public static void changed() {
        MAIN.post(() -> {
            for (Runnable r : LISTENERS) r.run();
        });
    }
}
