package com.example.electroui.fragments;

import android.content.Context;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.example.electroui.R;
import com.example.electroui.model.Apartment;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.model.Room;
import com.example.electroui.ui.StatTiles;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.UiUtil;
import com.google.android.material.progressindicator.LinearProgressIndicator;

import java.util.List;

/** 3-тапсырма: розеткадағы құралдардың қуатын, тогын, энергиясын және құнын есептеу. */
public class CalculationFragment extends BaseFragment {
    private GridLayout results;
    private TableLayout table;
    private TextView steps, tariffInfo;
    private LinearLayout load;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_calculation, container, false);
        results = v.findViewById(R.id.results);
        table = v.findViewById(R.id.table);
        steps = v.findViewById(R.id.steps);
        load = v.findViewById(R.id.load);
        tariffInfo = v.findViewById(R.id.tariff);
        UiUtil.fadeUp(v.findViewById(R.id.formula_card), 0);
        return v;
    }

    @Override
    protected void onDataChanged() {
        Apartment a = repo().load(uid());
        double tariff = settings().tariff();
        int limit = settings().limit(), roomLimit = settings().roomLimit();
        List<ElectricAppliance> on = a.plugged();
        int p = a.pluggedPower();

        StatTiles.clear(results);
        StatTiles.add(results, R.drawable.ic_bolt, Fmt.watts(p), "Жалпы қуат, P");
        StatTiles.add(results, R.drawable.ic_plug, Fmt.amps(a.pluggedCurrent()), "Ток күші, I");
        StatTiles.add(results, R.drawable.ic_timer, Fmt.kwh(a.dailyKwh()), "Тәулігіне, E");
        StatTiles.add(results, R.drawable.ic_chart, Fmt.dec(a.monthlyKwh(), 1) + " кВт·сағ", "Айына (30 күн)");
        StatTiles.add(results, R.drawable.ic_calc, Fmt.tenge(a.monthlyCost(tariff)), "Айлық төлем");
        StatTiles.add(results, R.drawable.ic_warning, Fmt.percent(100.0 * p / limit), "Автомат жүктемесі");

        // ----- кесте
        table.removeAllViews();
        header("#", "Құрал", "Бөлме", "P, Вт", "I, А", "t, сағ", "E, кВт·сағ", "₸/ай");
        int i = 1;
        for (ElectricAppliance e : on)
            row(false, String.valueOf(i++), e.getName(), e.getRoomName(), Fmt.integer(e.getPower()), Fmt.dec(e.current(), 2),
                    Fmt.num(e.getHoursPerDay()), Fmt.dec(e.dailyKwh(), 2), Fmt.integer(e.monthlyCost(tariff)));
        if (on.isEmpty()) row(false, "—", "Розеткада құрал жоқ", "", "0", "0", "", "0", "0");
        row(true, "", "БАРЛЫҒЫ", "", Fmt.integer(p), Fmt.dec(a.pluggedCurrent(), 2), "", Fmt.dec(a.dailyKwh(), 2),
                Fmt.integer(a.monthlyCost(tariff)));

        // ----- қадамдар
        StringBuilder sb = new StringBuilder();
        StringBuilder sum = new StringBuilder();
        StringBuilder energy = new StringBuilder();
        for (ElectricAppliance e : on) {
            if (sum.length() > 0) sum.append(" + ");
            sum.append(e.getPower());
            if (energy.length() > 0) energy.append(" + ");
            energy.append(e.getPower()).append("·").append(Fmt.num(e.getHoursPerDay()));
        }
        sb.append("1) P = ").append(sum.length() == 0 ? "0" : sum).append("\n   = ").append(Fmt.watts(p)).append("\n\n");
        sb.append("2) I = P / U = ").append(p).append(" / 220\n   = ").append(Fmt.amps(a.pluggedCurrent())).append("\n\n");
        sb.append("3) E = (").append(energy.length() == 0 ? "0" : energy).append(") / 1000\n   = ")
                .append(Fmt.kwh(a.dailyKwh())).append(" тәулігіне\n\n");
        sb.append("4) Құны = ").append(Fmt.dec(a.dailyKwh(), 2)).append(" · 30 · ").append(Fmt.num(tariff))
                .append("\n   = ").append(Fmt.tenge(a.monthlyCost(tariff))).append(" айына\n\n");
        sb.append("5) Жүктеме = P / ").append(limit).append(" = ").append(Fmt.percent(100.0 * p / limit))
                .append(p > limit ? "  ⚠ АСЫП КЕТТІ" : "  ✓ қалыпты");
        steps.setText(sb);

        // ----- жүктеме
        while (load.getChildCount() > 1) load.removeViewAt(1);
        loadRow("Бүкіл пәтер (кіріс автоматы 32 А)", p, limit);
        for (Room r : a.getRooms())
            loadRow(r.getName() + " · " + a.usedSockets(r.getId()) + "/" + r.getSockets() + " розетка", a.roomPower(r.getId()), roomLimit);

        tariffInfo.setText("Тариф: " + Fmt.num(tariff) + " ₸ / кВт·сағ. Пәтер шегі " + Fmt.watts(limit) + ", бір бөлме желісі "
                + Fmt.watts(roomLimit) + ". Бұл мәндерді әкімші «Баптаулар» бөлімінде өзгерте алады.");
    }

    private void header(String... cells) {
        row(true, cells);
    }

    private void row(boolean bold, String... cells) {
        Context c = requireContext();
        TableRow tr = new TableRow(c);
        if (bold) tr.setBackgroundResource(R.drawable.bg_soft);
        for (int i = 0; i < cells.length; i++) {
            TextView t = new TextView(c);
            t.setText(cells[i]);
            t.setTextSize(13);
            t.setPadding(UiUtil.dp(c, 8), UiUtil.dp(c, 7), UiUtil.dp(c, 8), UiUtil.dp(c, 7));
            t.setGravity(i >= 3 ? Gravity.END : Gravity.START);
            t.setTextColor(UiUtil.themeColor(c, com.google.android.material.R.attr.colorOnSurface));
            if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
            if (i == 1) t.setMaxWidth(UiUtil.dp(c, 170));
            tr.addView(t);
        }
        table.addView(tr);
    }

    private void loadRow(String label, int value, int max) {
        Context c = requireContext();
        TextView t = new TextView(c);
        t.setText(label + " — " + Fmt.watts(value) + " / " + Fmt.watts(max));
        t.setTextSize(13);
        t.setTextColor(UiUtil.themeColor(c, com.google.android.material.R.attr.colorOnSurface));
        t.setPadding(0, UiUtil.dp(c, 10), 0, UiUtil.dp(c, 4));
        load.addView(t);
        LinearProgressIndicator bar = new LinearProgressIndicator(c);
        bar.setMax(100);
        bar.setTrackThickness(UiUtil.dp(c, 8));
        bar.setTrackCornerRadius(UiUtil.dp(c, 4));
        int pct = (int) Math.min(100, Math.round(100.0 * value / max));
        bar.setIndicatorColor(value > max ? 0xFFE5484D : pct > 70 ? 0xFFF59E0B : 0xFF16A34A);
        load.addView(bar);
        bar.setProgressCompat(pct, true);
    }
}
