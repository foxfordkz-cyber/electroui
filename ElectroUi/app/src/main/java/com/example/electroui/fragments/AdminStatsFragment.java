package com.example.electroui.fragments;

import android.content.Context;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.GridLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.example.electroui.R;
import com.example.electroui.data.StatsRepository;
import com.example.electroui.model.ApplianceType;
import com.example.electroui.ui.BarChartView;
import com.example.electroui.ui.StatTiles;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.UiUtil;
import com.google.android.material.card.MaterialCardView;

import java.util.ArrayList;
import java.util.List;

/** Әкімші: барлық пайдаланушылар бойынша жиынтық SQL есептері. */
public class AdminStatsFragment extends BaseFragment {
    private GridLayout stats;
    private BarChartView chart;
    private LinearLayout reports;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_admin_stats, container, false);
        stats = v.findViewById(R.id.stats);
        chart = v.findViewById(R.id.chart);
        reports = v.findViewById(R.id.reports);
        return v;
    }

    @Override
    protected void onDataChanged() {
        StatsRepository repo = new StatsRepository(requireContext());
        int[] t = repo.totals();
        StatTiles.clear(stats);
        StatTiles.add(stats, R.drawable.ic_group, String.valueOf(t[0]), "Пайдаланушылар");
        StatTiles.add(stats, R.drawable.ic_category, String.valueOf(t[1]), "Жүйедегі құралдар");
        StatTiles.add(stats, R.drawable.ic_plug, String.valueOf(t[2]), "Розеткада");
        StatTiles.add(stats, R.drawable.ic_bolt, Fmt.watts(t[3]), "Жалпы қосулы қуат");

        List<BarChartView.Bar> bars = new ArrayList<>();
        for (String[] r : repo.powerByType()) {
            ApplianceType type = ApplianceType.of(r[0]);
            bars.add(new BarChartView.Bar(type.title(), r[2] + " дана", Fmt.watts(Integer.parseInt(r[1])),
                    Integer.parseInt(r[1]), type.category().color));
        }
        chart.setBars(bars, 1);

        reports.removeAllViews();
        for (StatsRepository.Report rep : repo.reports()) reports.addView(card(rep));
    }

    private View card(StatsRepository.Report rep) {
        Context c = requireContext();
        MaterialCardView card = new MaterialCardView(c);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = UiUtil.dp(c, 10);
        card.setLayoutParams(lp);
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        int p = UiUtil.dp(c, 14);
        box.setPadding(p, p, p, p);

        TextView title = new TextView(c);
        title.setText(rep.title);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextSize(15);
        title.setTextColor(UiUtil.themeColor(c, com.google.android.material.R.attr.colorOnSurface));
        box.addView(title);

        TextView sql = new TextView(c);
        sql.setText(rep.sql);
        sql.setTypeface(Typeface.MONOSPACE);
        sql.setTextSize(11);
        sql.setTextColor(0xFFC7D2FE);
        sql.setBackgroundResource(R.drawable.bg_code);
        int sp = UiUtil.dp(c, 10);
        sql.setPadding(sp, sp, sp, sp);
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        slp.topMargin = UiUtil.dp(c, 8);
        box.addView(sql, slp);

        TableLayout table = new TableLayout(c);
        table.addView(row(c, rep.columns.toArray(new String[0]), true));
        for (String[] r : rep.rows) table.addView(row(c, r, false));
        if (rep.rows.isEmpty()) table.addView(row(c, new String[]{"(нәтиже жоқ)"}, false));
        HorizontalScrollView hs = new HorizontalScrollView(c);
        hs.addView(table);
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        tlp.topMargin = UiUtil.dp(c, 8);
        box.addView(hs, tlp);

        TextView count = new TextView(c);
        count.setText(rep.rows.size() + " жол");
        count.setTextSize(11);
        count.setTextColor(UiUtil.themeColor(c, com.google.android.material.R.attr.colorOnSurfaceVariant));
        box.addView(count);
        card.addView(box);
        return card;
    }

    private TableRow row(Context c, String[] cells, boolean header) {
        TableRow tr = new TableRow(c);
        if (header) tr.setBackgroundResource(R.drawable.bg_soft);
        for (String cell : cells) {
            TextView t = new TextView(c);
            t.setText(cell);
            t.setTextSize(12);
            t.setPadding(UiUtil.dp(c, 8), UiUtil.dp(c, 6), UiUtil.dp(c, 8), UiUtil.dp(c, 6));
            t.setTextColor(UiUtil.themeColor(c, com.google.android.material.R.attr.colorOnSurface));
            if (header) t.setTypeface(Typeface.DEFAULT_BOLD);
            tr.addView(t);
        }
        return tr;
    }
}
