package com.example.electroui.ui;

import android.content.Context;
import android.view.Gravity;
import android.view.View;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.fragment.app.Fragment;

import com.example.electroui.R;
import com.example.electroui.data.SettingsRepository;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.model.Heating;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.Images;
import com.example.electroui.util.UiUtil;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.materialswitch.MaterialSwitch;

/** Құрал туралы толық ақпарат: иерархиядағы орны, полиморфты describe(), есептеулер, розетка. */
public final class ApplianceSheet {
    public interface Callbacks {
        void onPlug(ElectricAppliance a, boolean on);

        void onEdit(ElectricAppliance a);

        void onDelete(ElectricAppliance a);
    }

    private ApplianceSheet() {
    }

    public static void show(Fragment f, ElectricAppliance a, Callbacks cb) {
        Context c = f.requireContext();
        BottomSheetDialog d = new BottomSheetDialog(c);
        View v = View.inflate(c, R.layout.sheet_appliance, null);
        d.setContentView(v);
        double tariff = new SettingsRepository(c).tariff();

        ((ImageView) v.findViewById(R.id.image)).setImageResource(Images.forType(a.type()));
        ((TextView) v.findViewById(R.id.type)).setText(a.typeName() + " · " + a.category().title);
        ((TextView) v.findViewById(R.id.name)).setText(a.getName());
        ((TextView) v.findViewById(R.id.brand)).setText(a.getBrand()
                + (a.getRoomName().isEmpty() ? "" : " · " + a.getRoomName()));
        StringBuilder path = new StringBuilder();
        java.util.List<String> chain = a.hierarchyPath();
        for (int i = 0; i < chain.size(); i++) {
            if (i > 0) {
                path.append('\n');
                for (int s = 1; s < i; s++) path.append("   ");
                path.append("└─ ");
            }
            path.append(chain.get(i));
        }
        path.append("\n\nimplements ").append(interfaces(a));
        ((TextView) v.findViewById(R.id.path)).setText(path);
        ((TextView) v.findViewById(R.id.describe)).setText(a.describe());
        if (a instanceof Heating) { // instanceof — интерфейсті тексеру
            TextView heat = v.findViewById(R.id.heating);
            heat.setVisibility(View.VISIBLE);
            heat.setText(((Heating) a).heatingInfo() + ". Қараусыз қосулы қалдырмаңыз!");
        }

        GridLayout grid = v.findViewById(R.id.grid);
        stat(grid, "Қуаты, P", Fmt.watts(a.getPower()));
        stat(grid, "Кернеу, U", a.getVoltage() + " В");
        stat(grid, "Ток, I = P/U", Fmt.amps(a.current()));
        stat(grid, "Энергия класы", a.getEnergyClass());
        stat(grid, "Салмағы", Fmt.num(a.getWeight()) + " кг");
        stat(grid, a.extraLabel(), Fmt.num(a.getExtra()) + " " + a.extraUnit());
        stat(grid, "Жұмыс уақыты", Fmt.num(a.getHoursPerDay()) + " сағ/тәул.");
        stat(grid, "Тәулігіне", Fmt.kwh(a.dailyKwh()));
        stat(grid, "Айына", Fmt.tenge(a.monthlyCost(tariff)));

        MaterialSwitch plug = v.findViewById(R.id.plug);
        TextView title = v.findViewById(R.id.plug_title), sub = v.findViewById(R.id.plug_sub);
        Runnable render = () -> {
            title.setText(a.isPluggedIn() ? "Розеткаға қосулы" : "Розеткадан ажыратулы");
            sub.setText(a.isPluggedIn() ? "Желіден " + Fmt.watts(a.getPower()) + " алып тұр" : "Қуат тұтынбайды");
        };
        render.run();
        boolean editable = a.getRoomId() != 0;
        plug.setChecked(a.isPluggedIn());
        plug.setEnabled(editable);
        plug.setOnCheckedChangeListener((b, on) -> {
            cb.onPlug(a, on);
            d.dismiss();
        });
        v.findViewById(R.id.actions).setVisibility(editable ? View.VISIBLE : View.GONE);
        v.findViewById(R.id.btn_edit).setOnClickListener(b -> {
            d.dismiss();
            cb.onEdit(a);
        });
        v.findViewById(R.id.btn_delete).setOnClickListener(b -> new MaterialAlertDialogBuilder(c)
                .setTitle("Құралды жою")
                .setIcon(R.drawable.ic_delete)
                .setMessage("«" + a.getName() + "» пәтерден жойылсын ба? Бұл әрекетті қайтару мүмкін емес.")
                .setNegativeButton("Жоқ", null)
                .setPositiveButton("Жою", (x, y) -> {
                    d.dismiss();
                    cb.onDelete(a);
                })
                .show());
        d.show();
    }

    private static String interfaces(ElectricAppliance a) {
        StringBuilder sb = new StringBuilder();
        Class<?> cls = a.getClass();
        while (cls != null && cls != Object.class) {
            for (Class<?> i : cls.getInterfaces()) {
                if (sb.indexOf(i.getSimpleName()) >= 0) continue;
                if (sb.length() > 0) sb.append(", ");
                sb.append(i.getSimpleName());
            }
            cls = cls.getSuperclass();
        }
        return sb.toString();
    }

    private static void stat(GridLayout grid, String label, String value) {
        Context c = grid.getContext();
        LinearLayout cell = new LinearLayout(c);
        cell.setOrientation(LinearLayout.VERTICAL);
        cell.setBackgroundResource(R.drawable.bg_soft);
        int p = UiUtil.dp(c, 10);
        cell.setPadding(p, p, p, p);
        TextView l = new TextView(c);
        l.setText(label);
        l.setTextSize(11);
        l.setTextColor(UiUtil.themeColor(c, com.google.android.material.R.attr.colorOnSurfaceVariant));
        TextView val = new TextView(c);
        val.setText(value);
        val.setTextSize(15);
        val.setTypeface(val.getTypeface(), android.graphics.Typeface.BOLD);
        val.setTextColor(UiUtil.themeColor(c, com.google.android.material.R.attr.colorOnSurface));
        cell.addView(l);
        cell.addView(val);
        GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(GridLayout.UNDEFINED),
                GridLayout.spec(GridLayout.UNDEFINED, 1f));
        lp.width = 0;
        int m = UiUtil.dp(c, 3);
        lp.setMargins(m, m, m, m);
        lp.setGravity(Gravity.FILL);
        grid.addView(cell, lp);
    }
}
