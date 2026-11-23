package com.example.electroui.ui;

import android.view.LayoutInflater;
import android.view.View;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.TextView;

import com.example.electroui.R;
import com.example.electroui.util.UiUtil;

/** 2 бағаналы көрсеткіш тақташалары (иконка + сан + жазу). */
public final class StatTiles {
    private StatTiles() {
    }

    public static void clear(GridLayout grid) {
        grid.removeAllViews();
        grid.setColumnCount(2);
    }

    public static View add(GridLayout grid, int icon, String value, String label) {
        View v = LayoutInflater.from(grid.getContext()).inflate(R.layout.item_stat, grid, false);
        ((ImageView) v.findViewById(R.id.stat_icon)).setImageResource(icon);
        ((TextView) v.findViewById(R.id.stat_value)).setText(value);
        ((TextView) v.findViewById(R.id.stat_label)).setText(label);
        GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(GridLayout.UNDEFINED),
                GridLayout.spec(GridLayout.UNDEFINED, 1f));
        lp.width = 0;
        int m = UiUtil.dp(grid.getContext(), 5);
        lp.setMargins(m, m, m, m);
        grid.addView(v, lp);
        return v;
    }
}
