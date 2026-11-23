package com.example.electroui.fragments;

import android.content.Intent;
import android.database.Cursor;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.example.electroui.R;
import com.example.electroui.data.DbHelper;
import com.example.electroui.data.SettingsRepository;
import com.example.electroui.util.DataBus;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.Notifier;
import com.example.electroui.util.ThemeManager;
import com.example.electroui.util.UiUtil;
import com.google.android.material.button.MaterialButtonToggleGroup;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

/** Тақырыптар (режим + акцент түс), хабарламалар, әкімшінің жүйелік баптаулары, дерекқор туралы. */
public class SettingsFragment extends BaseFragment {
    private TextView permission, dbInfo;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_settings, container, false);
        permission = v.findViewById(R.id.permission);
        dbInfo = v.findViewById(R.id.db_info);

        MaterialButtonToggleGroup mode = v.findViewById(R.id.mode);
        int m = ThemeManager.mode(requireContext());
        mode.check(m == ThemeManager.MODE_LIGHT ? R.id.mode_light : m == ThemeManager.MODE_DARK ? R.id.mode_dark : R.id.mode_system);
        mode.addOnButtonCheckedListener((g, id, checked) -> {
            if (!checked) return;
            int newMode = id == R.id.mode_light ? ThemeManager.MODE_LIGHT : id == R.id.mode_dark ? ThemeManager.MODE_DARK : ThemeManager.MODE_SYSTEM;
            if (newMode != ThemeManager.mode(requireContext())) ThemeManager.setMode(requireContext(), newMode);
        });

        LinearLayout accents = v.findViewById(R.id.accents);
        int current = ThemeManager.accent(requireContext());
        for (int i = 0; i < ThemeManager.ACCENT_COLORS.length; i++) {
            final int index = i;
            LinearLayout col = new LinearLayout(requireContext());
            col.setOrientation(LinearLayout.VERTICAL);
            col.setGravity(Gravity.CENTER_HORIZONTAL);
            FrameLayout circle = new FrameLayout(requireContext());
            GradientDrawable g = new GradientDrawable();
            g.setShape(GradientDrawable.OVAL);
            g.setColor(ThemeManager.ACCENT_COLORS[i]);
            if (i == current) g.setStroke(UiUtil.dp(requireContext(), 4),
                    UiUtil.themeColor(requireContext(), com.google.android.material.R.attr.colorOnSurface));
            circle.setBackground(g);
            if (i == current) {
                ImageView check = new ImageView(requireContext());
                check.setImageResource(R.drawable.ic_check);
                check.setColorFilter(0xFFFFFFFF);
                circle.addView(check, new FrameLayout.LayoutParams(UiUtil.dp(requireContext(), 26),
                        UiUtil.dp(requireContext(), 26), Gravity.CENTER));
            }
            int size = UiUtil.dp(requireContext(), 52);
            col.addView(circle, new LinearLayout.LayoutParams(size, size));
            TextView label = new TextView(requireContext());
            label.setText(ThemeManager.ACCENT_NAMES[i]);
            label.setTextSize(12);
            label.setGravity(Gravity.CENTER);
            label.setTextColor(UiUtil.themeColor(requireContext(), com.google.android.material.R.attr.colorOnSurfaceVariant));
            col.addView(label);
            col.setOnClickListener(x -> {
                ThemeManager.setAccent(requireContext(), index);
                requireActivity().recreate();
            });
            accents.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        }

        MaterialSwitch notif = v.findViewById(R.id.notifications);
        notif.setChecked(ThemeManager.notificationsEnabled(requireContext()));
        notif.setOnCheckedChangeListener((b, on) -> ThemeManager.setNotificationsEnabled(requireContext(), on));
        v.findViewById(R.id.btn_permission).setOnClickListener(b -> startActivity(
                new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, requireContext().getPackageName())));

        if (user().isAdmin()) {
            v.findViewById(R.id.admin_card).setVisibility(View.VISIBLE);
            SettingsRepository s = settings();
            TextInputEditText tariff = v.findViewById(R.id.input_tariff), limit = v.findViewById(R.id.input_limit),
                    roomLimit = v.findViewById(R.id.input_room_limit);
            TextInputLayout lt = v.findViewById(R.id.tariff_layout), ll = v.findViewById(R.id.limit_layout),
                    lr = v.findViewById(R.id.room_limit_layout);
            tariff.setText(Fmt.num(s.tariff()).replace(',', '.').replace(" ", ""));
            limit.setText(String.valueOf(s.limit()));
            roomLimit.setText(String.valueOf(s.roomLimit()));
            v.findViewById(R.id.btn_save_system).setOnClickListener(b -> {
                lt.setError(null);
                ll.setError(null);
                lr.setError(null);
                try {
                    double t = Double.parseDouble(String.valueOf(tariff.getText()).replace(',', '.'));
                    int l = Integer.parseInt(String.valueOf(limit.getText()));
                    int r = Integer.parseInt(String.valueOf(roomLimit.getText()));
                    if (t <= 0 || t > 1000) { lt.setError("0 – 1000 ₸ аралығы"); return; }
                    if (l < 1000 || l > 50000) { ll.setError("1 000 – 50 000 Вт"); return; }
                    if (r < 500 || r > l) { lr.setError("500 Вт – пәтер шегі"); return; }
                    s.set(SettingsRepository.TARIFF, String.valueOf(t));
                    s.set(SettingsRepository.LIMIT, String.valueOf(l));
                    s.set(SettingsRepository.ROOM_LIMIT, String.valueOf(r));
                    main().snack("Жүйе баптаулары сақталды");
                    DataBus.changed();
                } catch (NumberFormatException e) {
                    lt.setError("Сан енгізіңіз");
                }
            });
        }
        UiUtil.fadeUp(v.findViewById(R.id.theme_card), 0);
        return v;
    }

    @Override
    protected void onDataChanged() {
        boolean granted = Notifier.permissionGranted(requireContext());
        permission.setText(granted ? "Рұқсат берілген: шамадан тыс жүктеме, әкімші хабарламалары экранға шығады."
                : "Android рұқсаты берілмеген — хабарламалар тек қосымша ішінде сақталады.");

        StringBuilder sb = new StringBuilder();
        sb.append("файл: ").append(requireContext().getDatabasePath(DbHelper.NAME).getName())
                .append("  (нұсқа ").append(DbHelper.VERSION).append(")\n\n");
        for (String t : DbHelper.TABLES) {
            try (Cursor c = DbHelper.get(requireContext()).getReadableDatabase().rawQuery("SELECT COUNT(*) FROM " + t, null)) {
                c.moveToFirst();
                sb.append(String.format("%-14s %4d жол\n", t, c.getInt(0)));
            }
        }
        sb.append("\nPRAGMA foreign_keys = ON\nON DELETE CASCADE: users → rooms → appliances");
        dbInfo.setText(sb);
    }
}
