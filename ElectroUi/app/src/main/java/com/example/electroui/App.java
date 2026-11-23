package com.example.electroui;

import android.app.Application;

import com.example.electroui.util.Notifier;
import com.example.electroui.util.ThemeManager;

/** Қосымша іске қосылғанда: тақырып режимі және хабарлама арналары. */
public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        ThemeManager.applyNightMode(this);
        Notifier.createChannels(this);
    }
}
