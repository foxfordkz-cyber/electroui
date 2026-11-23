package com.example.electroui;

import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.example.electroui.util.ThemeManager;
import com.example.electroui.util.UiUtil;

/** Барлық экрандардың ата-класы: таңдалған тақырыпты қолданады, экранды жолақтардың астына созады. */
public abstract class BaseActivity extends AppCompatActivity {
    private int appliedAccent;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        ThemeManager.applyTheme(this);
        appliedAccent = ThemeManager.accent(this);
        UiUtil.edgeToEdge(this);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (appliedAccent != ThemeManager.accent(this)) recreate();
    }
}
