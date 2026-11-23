package com.example.electroui.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.widget.NestedScrollView;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.electroui.R;
import com.example.electroui.model.Category;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.model.Room;
import com.example.electroui.model.SearchCriteria;
import com.example.electroui.ui.ApplianceAdapter;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.UiUtil;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.android.material.slider.RangeSlider;
import com.google.android.material.textfield.TextInputEditText;

import java.util.Arrays;
import java.util.List;

/** 5-тапсырма: берілген параметрлер диапазонына сай құралды табу (SQL BETWEEN). */
public class SearchFragment extends BaseFragment {
    private RangeSlider power, voltage, weight, hours;
    private TextView powerLabel, voltageLabel, weightLabel, hoursLabel, resultTitle, sql, empty;
    private ChipGroup energy, category, room;
    private MaterialSwitch plugged;
    private TextInputEditText text;
    private ApplianceAdapter adapter;
    private NestedScrollView scroll;
    private boolean searched;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_search, container, false);
        scroll = v.findViewById(R.id.scroll);
        power = v.findViewById(R.id.power);
        voltage = v.findViewById(R.id.voltage);
        weight = v.findViewById(R.id.weight);
        hours = v.findViewById(R.id.hours);
        powerLabel = v.findViewById(R.id.power_label);
        voltageLabel = v.findViewById(R.id.voltage_label);
        weightLabel = v.findViewById(R.id.weight_label);
        hoursLabel = v.findViewById(R.id.hours_label);
        resultTitle = v.findViewById(R.id.result_title);
        sql = v.findViewById(R.id.sql);
        empty = v.findViewById(R.id.empty);
        energy = v.findViewById(R.id.energy);
        category = v.findViewById(R.id.category);
        room = v.findViewById(R.id.room);
        plugged = v.findViewById(R.id.plugged);
        text = v.findViewById(R.id.text);

        RecyclerView results = v.findViewById(R.id.results);
        results.setLayoutManager(new LinearLayoutManager(requireContext()));
        adapter = new ApplianceAdapter(new ApplianceAdapter.Listener() {
            @Override public void onClick(ElectricAppliance a) { showDetails(a); }
            @Override public void onPlug(ElectricAppliance a, boolean on) { plug(a, on); }
        }, true, false, true);
        results.setAdapter(adapter);

        for (String c : ElectricAppliance.ENERGY_CLASSES) chip(energy, c, c);
        chip(category, "Барлығы", null).setChecked(true);
        for (Category c : Category.values()) chip(category, c.title, c);
        chip(room, "Барлығы", 0L).setChecked(true);
        for (Room r : repo().rooms(uid())) chip(room, r.getName(), r.getId());

        Chip powerful = chip(v.findViewById(R.id.presets), "Қуатты: 1500–3000 Вт", null);
        powerful.setOnClickListener(b -> preset(1500, 3000, 0, 80, null));
        Chip eco = chip(v.findViewById(R.id.presets), "Үнемді: A+++…A+", null);
        eco.setOnClickListener(b -> preset(0, 3000, 0, 80, new String[]{"A+++", "A++", "A+"}));
        Chip light = chip(v.findViewById(R.id.presets), "Жеңіл: 5 кг-ға дейін", null);
        light.setOnClickListener(b -> preset(0, 3000, 0, 5, null));
        Chip small = chip(v.findViewById(R.id.presets), "Аз қуат: 0–200 Вт", null);
        small.setOnClickListener(b -> preset(0, 200, 0, 80, null));
        for (Chip c : new Chip[]{powerful, eco, light, small}) c.setCheckable(false);

        reset();
        RangeSlider.OnChangeListener labels = (s, value, fromUser) -> updateLabels();
        for (RangeSlider s : new RangeSlider[]{power, voltage, weight, hours}) {
            s.addOnChangeListener(labels);
            s.addOnSliderTouchListener(new RangeSlider.OnSliderTouchListener() {
                @Override public void onStartTrackingTouch(@NonNull RangeSlider slider) { }
                @Override public void onStopTrackingTouch(@NonNull RangeSlider slider) { search(false); }
            });
        }
        power.setLabelFormatter(val -> Fmt.integer(val) + " Вт");
        voltage.setLabelFormatter(val -> Fmt.integer(val) + " В");
        weight.setLabelFormatter(val -> Fmt.num(val) + " кг");
        hours.setLabelFormatter(val -> Fmt.num(val) + " сағ");
        energy.setOnCheckedStateChangeListener((g, ids) -> search(false));
        category.setOnCheckedStateChangeListener((g, ids) -> search(false));
        room.setOnCheckedStateChangeListener((g, ids) -> search(false));
        plugged.setOnCheckedChangeListener((b, on) -> search(false));
        text.setOnEditorActionListener((tv, id, e) -> {
            if (id == EditorInfo.IME_ACTION_SEARCH) {
                search(true);
                return true;
            }
            return false;
        });
        v.findViewById(R.id.btn_search).setOnClickListener(b -> search(true));
        v.findViewById(R.id.btn_reset).setOnClickListener(b -> {
            reset();
            search(false);
        });
        UiUtil.fadeUp(v.findViewById(R.id.head), 0);
        return v;
    }

    private Chip chip(ChipGroup group, String label, Object tag) {
        Chip c = (Chip) LayoutInflater.from(requireContext()).inflate(R.layout.chip_filter, group, false);
        c.setId(View.generateViewId());
        c.setText(label);
        c.setTag(tag);
        group.addView(c);
        return c;
    }

    private void reset() {
        power.setValues(0f, (float) SearchCriteria.POWER_MAX);
        voltage.setValues(0f, (float) SearchCriteria.VOLTAGE_MAX);
        weight.setValues(0f, (float) SearchCriteria.WEIGHT_MAX);
        hours.setValues(0f, (float) SearchCriteria.HOURS_MAX);
        energy.clearCheck();
        ((Chip) category.getChildAt(0)).setChecked(true);
        ((Chip) room.getChildAt(0)).setChecked(true);
        plugged.setChecked(false);
        text.setText("");
        updateLabels();
    }

    private void preset(int pMin, int pMax, float wMin, float wMax, String[] classes) {
        reset();
        power.setValues((float) pMin, (float) pMax);
        weight.setValues(wMin, wMax);
        if (classes != null) {
            List<String> wanted = Arrays.asList(classes);
            for (int i = 0; i < energy.getChildCount(); i++) {
                Chip c = (Chip) energy.getChildAt(i);
                c.setChecked(wanted.contains((String) c.getTag()));
            }
        }
        updateLabels();
        search(true);
    }

    private void updateLabels() {
        List<Float> p = power.getValues(), u = voltage.getValues(), w = weight.getValues(), h = hours.getValues();
        powerLabel.setText("Қуаты: " + Fmt.integer(p.get(0)) + " – " + Fmt.integer(p.get(1)) + (p.get(1) >= SearchCriteria.POWER_MAX ? "+" : "") + " Вт");
        voltageLabel.setText("Кернеуі: " + Fmt.integer(u.get(0)) + " – " + Fmt.integer(u.get(1)) + " В");
        weightLabel.setText("Салмағы: " + Fmt.num(w.get(0)) + " – " + Fmt.num(w.get(1)) + (w.get(1) >= SearchCriteria.WEIGHT_MAX ? "+" : "") + " кг");
        hoursLabel.setText("Тәулігіне жұмысы: " + Fmt.num(h.get(0)) + " – " + Fmt.num(h.get(1)) + " сағ");
    }

    private SearchCriteria criteria() {
        SearchCriteria c = new SearchCriteria();
        c.minPower = Math.round(power.getValues().get(0));
        c.maxPower = Math.round(power.getValues().get(1));
        c.minVoltage = Math.round(voltage.getValues().get(0));
        c.maxVoltage = Math.round(voltage.getValues().get(1));
        c.minWeight = weight.getValues().get(0);
        c.maxWeight = weight.getValues().get(1);
        c.minHours = hours.getValues().get(0);
        c.maxHours = hours.getValues().get(1);
        for (int i = 0; i < energy.getChildCount(); i++) {
            Chip chip = (Chip) energy.getChildAt(i);
            if (chip.isChecked()) c.energyClasses.add((String) chip.getTag());
        }
        for (int i = 0; i < category.getChildCount(); i++) {
            Chip chip = (Chip) category.getChildAt(i);
            if (chip.isChecked()) c.category = (Category) chip.getTag();
        }
        for (int i = 0; i < room.getChildCount(); i++) {
            Chip chip = (Chip) room.getChildAt(i);
            if (chip.isChecked()) c.roomId = (Long) chip.getTag();
        }
        c.pluggedOnly = plugged.isChecked();
        c.text = text.getText() == null ? "" : text.getText().toString();
        return c;
    }

    private void search(boolean scrollToResults) {
        if (getView() == null) return;
        StringBuilder sqlText = new StringBuilder();
        List<ElectricAppliance> found = repo().search(uid(), criteria(), sqlText);
        searched = true;
        sql.setText(sqlText);
        int total = 0;
        for (ElectricAppliance a : found) total += a.getPower();
        resultTitle.setText("Табылды: " + found.size() + " құрал · барлығы " + Fmt.watts(total));
        adapter.submit(found);
        empty.setVisibility(found.isEmpty() ? View.VISIBLE : View.GONE);
        if (scrollToResults) scroll.post(() -> scroll.smoothScrollTo(0, resultTitle.getTop() - UiUtil.dp(requireContext(), 8)));
    }

    @Override
    protected void onDataChanged() {
        if (getView() != null && power != null) search(false);
    }
}
