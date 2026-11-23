package com.example.electroui.ui;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.view.View;
import android.view.animation.DecelerateInterpolator;

import com.example.electroui.util.UiUtil;

import java.util.ArrayList;
import java.util.List;

/** Көлденең бағаналы диаграмма: бөлмелер, санаттар, сұрыптау рейтингі. */
public class BarChartView extends View {
    public static class Bar {
        final String label;
        final String sub;
        final String valueText;
        final float value;
        final int color;

        public Bar(String label, String sub, String valueText, float value, int color) {
            this.label = label;
            this.sub = sub;
            this.valueText = valueText;
            this.value = value;
            this.color = color;
        }
    }

    private final List<Bar> bars = new ArrayList<>();
    private final Paint label = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint sub = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint value = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint back = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();
    private float max = 1f;
    private float progress = 1f;
    private final int rowH;
    private final int barH;

    public BarChartView(Context context, AttributeSet attrs) {
        super(context, attrs);
        rowH = UiUtil.dp(context, 46);
        barH = UiUtil.dp(context, 10);
        label.setColor(UiUtil.themeColor(context, com.google.android.material.R.attr.colorOnSurface));
        label.setTextSize(UiUtil.dp(context, 14));
        label.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        sub.setColor(UiUtil.themeColor(context, com.google.android.material.R.attr.colorOnSurfaceVariant));
        sub.setTextSize(UiUtil.dp(context, 12));
        value.set(label);
        value.setTextAlign(Paint.Align.RIGHT);
        back.setColor(UiUtil.themeColor(context, com.google.android.material.R.attr.colorOutline));
        back.setAlpha(90);
    }

    public void setBars(List<Bar> list, float maxValue) {
        bars.clear();
        bars.addAll(list);
        float m = maxValue;
        for (Bar b : list) m = Math.max(m, b.value);
        max = Math.max(1f, m);
        requestLayout();
        ValueAnimator a = ValueAnimator.ofFloat(0f, 1f);
        a.setDuration(800);
        a.setInterpolator(new DecelerateInterpolator(1.8f));
        a.addUpdateListener(v -> {
            progress = (float) v.getAnimatedValue();
            invalidate();
        });
        a.start();
    }

    @Override
    protected void onMeasure(int widthSpec, int heightSpec) {
        setMeasuredDimension(MeasureSpec.getSize(widthSpec), Math.max(rowH, bars.size() * rowH));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float w = getWidth();
        for (int i = 0; i < bars.size(); i++) {
            Bar b = bars.get(i);
            float top = i * rowH;
            float textY = top + UiUtil.dp(getContext(), 17);
            canvas.drawText(b.label, 0, textY, label);
            if (b.sub != null && !b.sub.isEmpty())
                canvas.drawText("  " + b.sub, label.measureText(b.label), textY, sub);
            canvas.drawText(b.valueText, w, textY, value);
            float barTop = top + UiUtil.dp(getContext(), 25);
            rect.set(0, barTop, w, barTop + barH);
            canvas.drawRoundRect(rect, barH / 2f, barH / 2f, back);
            float stagger = Math.max(0f, Math.min(1f, progress * 1.4f - i * 0.06f));
            float len = w * (b.value / max) * stagger;
            if (len > 0) {
                fill.setColor(b.color);
                rect.set(0, barTop, Math.max(barH, len), barTop + barH);
                canvas.drawRoundRect(rect, barH / 2f, barH / 2f, fill);
            }
        }
    }
}
