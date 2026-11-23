package com.example.electroui.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.electroui.R;
import com.example.electroui.model.Apartment;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.model.SortMode;
import com.example.electroui.ui.ApplianceAdapter;
import com.example.electroui.ui.BarChartView;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.UiUtil;
import com.google.android.material.button.MaterialButtonToggleGroup;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.materialswitch.MaterialSwitch;

import java.util.ArrayList;
import java.util.List;

/** 4-тапсырма: пәтердегі құралдарды қуат бойынша сұрыптау. */
public class SortFragment extends BaseFragment {
    private SortMode mode = SortMode.POWER_DESC;
    private boolean onlyPlugged;
    private MaterialButtonToggleGroup order;
    private ChipGroup other;
    private TextView code, chartTitle;
    private BarChartView chart;
    private ApplianceAdapter adapter;
    private boolean syncing;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_sort, container, false);
        order = v.findViewById(R.id.order);
        other = v.findViewById(R.id.other);
        code = v.findViewById(R.id.code);
        chart = v.findViewById(R.id.chart);
        chartTitle = v.findViewById(R.id.chart_title);
        RecyclerView list = v.findViewById(R.id.list);
        list.setLayoutManager(new LinearLayoutManager(requireContext()));
        adapter = new ApplianceAdapter(new ApplianceAdapter.Listener() {
            @Override public void onClick(ElectricAppliance a) { showDetails(a); }
            @Override public void onPlug(ElectricAppliance a, boolean on) { plug(a, on); }
        }, false, true, true);
        list.setAdapter(adapter);

        for (SortMode m : new SortMode[]{SortMode.DAILY, SortMode.ENERGY, SortMode.NAME, SortMode.WEIGHT}) {
            Chip chip = (Chip) inflater.inflate(R.layout.chip_filter, other, false);
            chip.setId(View.generateViewId());
            chip.setText(m.title);
            chip.setTag(m);
            other.addView(chip);
        }
        order.check(R.id.btn_desc);
        order.addOnButtonCheckedListener((g, id, checked) -> {
            if (!checked || syncing) return;
            mode = id == R.id.btn_asc ? SortMode.POWER_ASC : SortMode.POWER_DESC;
            syncing = true;
            other.clearCheck();
            syncing = false;
            onDataChanged();
        });
        other.setOnCheckedStateChangeListener((g, ids) -> {
            if (syncing || ids.isEmpty()) return;
            mode = (SortMode) g.findViewById(ids.get(0)).getTag();
            syncing = true;
            order.clearChecked();
            syncing = false;
            onDataChanged();
        });
        ((MaterialSwitch) v.findViewById(R.id.only_plugged)).setOnCheckedChangeListener((b, on) -> {
            onlyPlugged = on;
            onDataChanged();
        });
        UiUtil.fadeUp(v.findViewById(R.id.head), 0);
        return v;
    }

    @Override
    protected void onDataChanged() {
        Apartment a = repo().load(uid());
        List<ElectricAppliance> sorted = a.sort(mode);
        if (onlyPlugged) sorted.removeIf(e -> !e.isPluggedIn());

        code.setText("List<ElectricAppliance> list = apartment.getAppliances();\nlist.sort(" + mode.code + ");"
                + (onlyPlugged ? "\nlist.removeIf(a -> !a.isPluggedIn());" : ""));
        chartTitle.setText("Рейтинг: " + mode.title + " (" + sorted.size() + " құрал)");

        boolean byKwh = mode == SortMode.DAILY;
        boolean byWeight = mode == SortMode.WEIGHT;
        List<BarChartView.Bar> bars = new ArrayList<>();
        int primary = UiUtil.themeColor(requireContext(), androidx.appcompat.R.attr.colorPrimary);
        int i = 1;
        for (ElectricAppliance e : sorted) {
            float value = byKwh ? (float) e.dailyKwh() : byWeight ? (float) e.getWeight() : e.getPower();
            String text = byKwh ? Fmt.kwh(e.dailyKwh()) : byWeight ? Fmt.num(e.getWeight()) + " кг"
                    : mode == SortMode.ENERGY ? e.getEnergyClass() + " · " + Fmt.watts(e.getPower()) : Fmt.watts(e.getPower());
            int color = mode == SortMode.ENERGY ? ApplianceAdapter.energyColor(e.getEnergyClass())
                    : e.isPluggedIn() ? primary : e.category().color;
            bars.add(new BarChartView.Bar(i++ + ". " + e.getName(), e.isPluggedIn() ? "⚡" : "", text,
                    mode == SortMode.ENERGY ? 7 - e.energyRank() : value, color));
        }
        chart.setBars(bars, 1);
        adapter.submit(sorted);
    }
}
