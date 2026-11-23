package com.example.electroui.fragments;

import android.content.Intent;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.example.electroui.ApplianceFormActivity;
import com.example.electroui.R;
import com.example.electroui.data.StatsRepository;
import com.example.electroui.model.Apartment;
import com.example.electroui.model.Category;
import com.example.electroui.model.Room;
import com.example.electroui.ui.BarChartView;
import com.example.electroui.ui.PowerGaugeView;
import com.example.electroui.ui.StatTiles;
import com.example.electroui.util.DataBus;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.UiUtil;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Map;

/** Басты бет: қосулы қуат өлшегіші, көрсеткіштер, бөлмелер мен санаттар диаграммасы. */
public class HomeFragment extends BaseFragment {
    private static final String[] TIPS = {
            "Кеңес: құралды «күту режимінде» қалдырмаңыз — теледидар мен компьютер өшірулі тұрса да 1–5 Вт тұтынады.",
            "Кеңес: шәйнекке керегінше ғана су құйыңыз — 1 литр артық су ≈ 0,1 кВт·сағ.",
            "Кеңес: A+++ класты кір жуғыш машина D класына қарағанда 2 есе аз энергия жұмсайды.",
            "Кеңес: 10 Вт LED шам 75 Вт қыздыру шамымен бірдей жарық береді.",
            "Кеңес: қуаты 2 кВт-тан асатын құралдарды бір розеткаға қатар қоспаңыз — желі қызады.",
            "Кеңес: тоңазытқышты пеш пен жылытқыштан алыс қойыңыз — компрессор аз жұмыс істейді."};

    private PowerGaugeView gauge;
    private TextView greeting, status, overload, stateChip, tip, adminStats;
    private GridLayout stats;
    private BarChartView roomsChart, catChart;
    private LinearLayout events;
    private View adminCard;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_home, container, false);
        gauge = v.findViewById(R.id.gauge);
        greeting = v.findViewById(R.id.greeting);
        status = v.findViewById(R.id.status);
        overload = v.findViewById(R.id.overload);
        stateChip = v.findViewById(R.id.state_chip);
        tip = v.findViewById(R.id.tip);
        stats = v.findViewById(R.id.stats);
        roomsChart = v.findViewById(R.id.rooms_chart);
        catChart = v.findViewById(R.id.cat_chart);
        events = v.findViewById(R.id.events);
        adminCard = v.findViewById(R.id.admin_card);
        adminStats = v.findViewById(R.id.admin_stats);

        v.findViewById(R.id.btn_3d).setOnClickListener(b -> main().open(R.id.nav_3d));
        v.findViewById(R.id.btn_add).setOnClickListener(b ->
                startActivity(new Intent(requireContext(), ApplianceFormActivity.class)));
        v.findViewById(R.id.btn_unplug).setOnClickListener(b -> new MaterialAlertDialogBuilder(requireContext())
                .setTitle("Барлығын ажырату")
                .setIcon(R.drawable.ic_unplug)
                .setMessage("Пәтердегі барлық құралды розеткадан ажыратасыз ба?")
                .setNegativeButton("Жоқ", null)
                .setPositiveButton("Иә, ажырату", (d, w) -> {
                    int n = repo().unplugAll(uid());
                    main().snack(n == 0 ? "Розеткада ешнәрсе жоқ еді" : n + " құрал розеткадан ажыратылды");
                    DataBus.changed();
                })
                .show());
        v.findViewById(R.id.btn_admin_users).setOnClickListener(b -> main().open(R.id.nav_admin_users));
        v.findViewById(R.id.btn_admin_stats).setOnClickListener(b -> main().open(R.id.nav_admin_stats));

        UiUtil.fadeUp(v.findViewById(R.id.hero_card), 0);
        UiUtil.fadeUp(v.findViewById(R.id.gauge_card), 100);
        UiUtil.fadeUp(stats, 200);
        v.findViewById(R.id.hero).animate().scaleX(1.1f).scaleY(1.1f).setDuration(12000).start();
        tip.setText(TIPS[(int) (System.currentTimeMillis() / 60000 % TIPS.length)]);
        return v;
    }

    @Override
    protected void onDataChanged() {
        Apartment a = repo().load(uid());
        int limit = settings().limit(), roomLimit = settings().roomLimit();
        double tariff = settings().tariff();
        int power = a.pluggedPower();

        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        String hello = hour < 5 ? "Қайырлы түн" : hour < 12 ? "Қайырлы таң" : hour < 18 ? "Қайырлы күн" : "Қайырлы кеш";
        greeting.setText(hello + ", " + user().firstName() + "!");
        status.setText(a.getAppliances().isEmpty() ? "Пәтеріңізде әзірге құрал жоқ — біріншісін қосыңыз"
                : "Пәтерде " + a.getAppliances().size() + " құрал, розеткада " + a.plugged().size() + " · "
                + a.getRooms().size() + " бөлме, " + a.totalSockets() + " розетка");

        gauge.setValue(power, limit);
        boolean over = power > limit;
        boolean warn = power > limit * 0.75;
        GradientDrawable chip = new GradientDrawable();
        chip.setCornerRadius(100f);
        chip.setColor(over ? 0xFFE5484D : warn ? 0xFFF59E0B : 0xFF16A34A);
        stateChip.setBackground(chip);
        stateChip.setText(over ? "ШАМАДАН ТЫС" : warn ? "ЖОҒАРЫ" : "ҚАЛЫПТЫ");

        List<String> hot = new ArrayList<>();
        for (Room r : a.getRooms()) if (a.roomPower(r.getId()) > roomLimit) hot.add(r.getName());
        if (over || !hot.isEmpty()) {
            overload.setVisibility(View.VISIBLE);
            overload.setText(over ? "Пәтер желісі шамадан тыс жүктелген: " + Fmt.watts(power) + " > " + Fmt.watts(limit)
                    + ". Кіріс автоматы сөнуі мүмкін!" : "Бөлме желісі қызып тұр: " + String.join(", ", hot));
        } else overload.setVisibility(View.GONE);

        StatTiles.clear(stats);
        StatTiles.add(stats, R.drawable.ic_plug, a.plugged().size() + " / " + a.getAppliances().size(), "Розеткадағы құралдар");
        StatTiles.add(stats, R.drawable.ic_bolt, Fmt.amps(a.pluggedCurrent()), "Ток күші, I = P / U");
        StatTiles.add(stats, R.drawable.ic_timer, Fmt.kwh(a.dailyKwh()), "Тәулігіне энергия");
        StatTiles.add(stats, R.drawable.ic_calc, Fmt.tenge(a.monthlyCost(tariff)), "Айына (" + Fmt.num(tariff) + " ₸/кВт·сағ)");

        List<BarChartView.Bar> rooms = new ArrayList<>();
        for (Room r : a.getRooms()) {
            int rp = a.roomPower(r.getId());
            int color = rp > roomLimit ? 0xFFE5484D : rp > roomLimit * 0.7 ? 0xFFF59E0B
                    : UiUtil.themeColor(requireContext(), androidx.appcompat.R.attr.colorPrimary);
            rooms.add(new BarChartView.Bar(r.getName(), a.usedSockets(r.getId()) + "/" + r.getSockets() + " розетка",
                    Fmt.watts(rp), rp, color));
        }
        roomsChart.setBars(rooms, roomLimit);

        List<BarChartView.Bar> cats = new ArrayList<>();
        for (Map.Entry<Category, Integer> e : a.powerByCategory().entrySet())
            cats.add(new BarChartView.Bar(e.getKey().title, "", Fmt.watts(e.getValue()), e.getValue(), e.getKey().color));
        catChart.setBars(cats, 1);

        events.removeAllViews();
        List<String[]> list = repo().recentEvents(uid(), 6);
        if (list.isEmpty()) addEvent("Әзірге әрекет жоқ", "");
        for (String[] e : list)
            addEvent(e[0] + " — " + Fmt.action(e[1]) + ("0".equals(e[2]) ? "" : " (" + Fmt.watts(Integer.parseInt(e[2])) + ")"),
                    Fmt.ago(Long.parseLong(e[3])));

        if (user().isAdmin()) {
            adminCard.setVisibility(View.VISIBLE);
            int[] t = new StatsRepository(requireContext()).totals();
            adminStats.setText("Пайдаланушылар: " + t[0] + "\nЖүйедегі құралдар: " + t[1] + " (розеткада " + t[2] + ")\n"
                    + "Барлық пәтерлердегі қосулы қуат: " + Fmt.watts(t[3]));
        }
    }

    private void addEvent(String text, String time) {
        View row = LayoutInflater.from(requireContext()).inflate(android.R.layout.simple_list_item_2, events, false);
        TextView t1 = row.findViewById(android.R.id.text1), t2 = row.findViewById(android.R.id.text2);
        t1.setText(text);
        t1.setTextSize(14);
        t1.setTextColor(UiUtil.themeColor(requireContext(), com.google.android.material.R.attr.colorOnSurface));
        t2.setText(time);
        t2.setTextColor(UiUtil.themeColor(requireContext(), com.google.android.material.R.attr.colorOnSurfaceVariant));
        row.setPadding(0, UiUtil.dp(requireContext(), 6), 0, UiUtil.dp(requireContext(), 6));
        row.setMinimumHeight(0);
        events.addView(row);
    }
}
