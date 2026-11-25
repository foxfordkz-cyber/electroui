package com.example.electroui;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.LinearInterpolator;
import android.widget.TextView;

import com.example.electroui.data.DbHelper;
import com.example.electroui.data.Session;
import com.example.electroui.model.User;
import com.example.electroui.util.UiUtil;

import java.util.concurrent.Executors;

/** Бастапқы экран: 3D айналатын белгі, фонда дерекқор дайындалады. */
public class SplashActivity extends BaseActivity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private volatile boolean dbReady;
    private boolean minTimePassed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);
        UiUtil.insets(findViewById(R.id.bottom), false, true);

        View outer = findViewById(R.id.ring_outer), inner = findViewById(R.id.ring_inner), bolt = findViewById(R.id.bolt);
        float density = getResources().getDisplayMetrics().density;
        for (View v : new View[]{outer, inner, bolt}) v.setCameraDistance(8000 * density);
        spin(outer, View.ROTATION_Y.getName(), 2600);
        spin(inner, View.ROTATION_X.getName(), 2000);
        ObjectAnimator flip = ObjectAnimator.ofFloat(bolt, View.ROTATION_Y, 0f, 360f);
        flip.setDuration(1800);
        flip.setRepeatCount(ValueAnimator.INFINITE);
        flip.start();
        UiUtil.pop(bolt, 100);
        UiUtil.fadeUp(findViewById(R.id.title), 250);
        UiUtil.fadeUp(findViewById(R.id.tagline), 400);

        TextView status = findViewById(R.id.status);
        Executors.newSingleThreadExecutor().execute(() -> {
            DbHelper.get(this).getWritableDatabase(); // алғаш іске қосқанда кестелер мен деректер жасалады
            dbReady = true;
            handler.post(() -> {
                status.setText("Дайын!");
                tryContinue();
            });
        });
        handler.postDelayed(() -> {
            minTimePassed = true;
            tryContinue();
        }, 1700);
    }

    private void spin(View v, String property, long duration) {
        ObjectAnimator a = ObjectAnimator.ofFloat(v, property, 0f, 360f);
        a.setDuration(duration);
        a.setInterpolator(new LinearInterpolator());
        a.setRepeatCount(ValueAnimator.INFINITE);
        a.start();
    }

    private void tryContinue() {
        if (!dbReady || !minTimePassed || isFinishing()) return;
        User user = Session.user(this);
        String open = getIntent().getStringExtra(com.example.electroui.util.Notifier.EXTRA_OPEN);
        boolean online = getSharedPreferences("navigation", MODE_PRIVATE).getBoolean("online", user == null);
        Class<?> destination = user == null ? LoginActivity.class : MainActivity.class;
        if (open == null && online) destination = EnergyMapActivity.class;
        Intent next = new Intent(this, destination);
        if (open != null) next.putExtra(com.example.electroui.util.Notifier.EXTRA_OPEN, open); // қай бөлімді ашу
        startActivity(next);
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        finish();
    }
}
