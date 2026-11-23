package com.example.electroui.util;

import android.content.Context;
import android.graphics.Color;
import android.util.TypedValue;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.OvershootInterpolator;

import androidx.activity.ComponentActivity;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/** Экранға ортақ көмекші әдістер: dp, тақырып түстері, жүйелік жолақтар, анимациялар. */
public final class UiUtil {
    private UiUtil() {
    }

    public static int dp(Context c, float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics()));
    }

    public static int themeColor(Context c, int attr) {
        TypedValue tv = new TypedValue();
        c.getTheme().resolveAttribute(attr, tv, true);
        return tv.resourceId != 0 ? c.getColor(tv.resourceId) : tv.data;
    }

    /** Экран жүйелік жолақтардың астына дейін созылады; жоғарғы белгішелер ақ түсті. */
    public static void edgeToEdge(ComponentActivity a) {
        boolean dark = ThemeManager.isDark(a);
        EdgeToEdge.enable(a, SystemBarStyle.dark(Color.TRANSPARENT),
                dark ? SystemBarStyle.dark(Color.TRANSPARENT)
                        : SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT));
    }

    /** Жүйелік жолақтардың өлшемін көрініске padding ретінде қосады. */
    public static void insets(View v, boolean top, boolean bottom) {
        final int l = v.getPaddingLeft(), t = v.getPaddingTop(), r = v.getPaddingRight(), b = v.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(v, (view, wi) -> {
            Insets bars = wi.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = wi.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(l + bars.left, t + (top ? bars.top : 0), r + bars.right,
                    b + (bottom ? Math.max(bars.bottom, ime.bottom) : 0));
            return wi;
        });
        ViewCompat.requestApplyInsets(v);
    }

    public static void fadeUp(View v, long delay) {
        v.setAlpha(0f);
        v.setTranslationY(dp(v.getContext(), 24));
        v.animate().alpha(1f).translationY(0).setStartDelay(delay).setDuration(450)
                .setInterpolator(new DecelerateInterpolator(1.6f)).start();
    }

    public static void pop(View v, long delay) {
        v.setScaleX(0.6f);
        v.setScaleY(0.6f);
        v.setAlpha(0f);
        v.animate().scaleX(1f).scaleY(1f).alpha(1f).setStartDelay(delay).setDuration(420)
                .setInterpolator(new OvershootInterpolator(1.4f)).start();
    }

    public static void pulse(View v) {
        v.animate().scaleX(1.08f).scaleY(1.08f).setDuration(120).withEndAction(
                () -> v.animate().scaleX(1f).scaleY(1f).setDuration(160).start()).start();
    }

    public static void shake(View v) {
        v.animate().translationX(dp(v.getContext(), 10)).setDuration(50).withEndAction(() ->
                v.animate().translationX(-dp(v.getContext(), 10)).setDuration(70).withEndAction(() ->
                        v.animate().translationX(0).setDuration(60).start()).start()).start();
    }
}
