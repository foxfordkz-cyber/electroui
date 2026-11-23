package com.example.electroui.ui;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.SweepGradient;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.view.View;
import android.view.animation.DecelerateInterpolator;

import com.example.electroui.util.Fmt;
import com.example.electroui.util.UiUtil;

/** Қосулы қуаттың доға тәрізді өлшегіші (спидометр сияқты). */
public class PowerGaugeView extends View {
    private static final float START = 150f;
    private static final float SWEEP = 240f;

    private final Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint arc = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint tick = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint big = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint small = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF oval = new RectF();
    private float shown;
    private int value;
    private int max = 7000;
    private ValueAnimator animator;

    public PowerGaugeView(Context context, AttributeSet attrs) {
        super(context, attrs);
        int text = UiUtil.themeColor(context, com.google.android.material.R.attr.colorOnSurface);
        int sub = UiUtil.themeColor(context, com.google.android.material.R.attr.colorOnSurfaceVariant);
        int outline = UiUtil.themeColor(context, com.google.android.material.R.attr.colorOutline);
        track.setStyle(Paint.Style.STROKE);
        track.setStrokeCap(Paint.Cap.ROUND);
        track.setColor(outline);
        arc.setStyle(Paint.Style.STROKE);
        arc.setStrokeCap(Paint.Cap.ROUND);
        tick.setColor(sub);
        tick.setStrokeWidth(UiUtil.dp(context, 1.5f));
        big.setColor(text);
        big.setTextAlign(Paint.Align.CENTER);
        big.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        small.setColor(sub);
        small.setTextAlign(Paint.Align.CENTER);
    }

    public void setValue(int value, int max) {
        this.value = value;
        this.max = Math.max(1, max);
        if (animator != null) animator.cancel();
        animator = ValueAnimator.ofFloat(shown, value);
        animator.setDuration(900);
        animator.setInterpolator(new DecelerateInterpolator(1.5f));
        animator.addUpdateListener(a -> {
            shown = (float) a.getAnimatedValue();
            invalidate();
        });
        animator.start();
    }

    @Override
    protected void onMeasure(int widthSpec, int heightSpec) {
        int w = MeasureSpec.getSize(widthSpec);
        int size = Math.min(w, UiUtil.dp(getContext(), 260));
        setMeasuredDimension(w, (int) (size * 0.9f));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float w = getWidth(), h = getHeight();
        float size = Math.min(w, h / 0.9f);
        float stroke = size * 0.075f;
        float cx = w / 2f, cy = size / 2f + stroke * 0.4f;
        float r = size / 2f - stroke;
        oval.set(cx - r, cy - r, cx + r, cy + r);

        track.setStrokeWidth(stroke);
        track.setAlpha(110);
        canvas.drawArc(oval, START, SWEEP, false, track);

        float ratio = Math.min(1f, shown / max);
        boolean over = value > max;
        // 240° доға шеңбердің 2/3 бөлігі; соңғы аялдама жасыл — доғаның басындағы дөңгелек ұшы қызыл болмауы үшін
        int[] colors = {0xFF22C55E, 0xFF84CC16, 0xFFF59E0B, 0xFFEF4444, 0xFFEF4444, 0xFF22C55E};
        float[] stops = {0f, 0.27f, 0.47f, 0.66f, 0.9f, 1f};
        SweepGradient g = new SweepGradient(cx, cy, colors, stops);
        Matrix m = new Matrix();
        m.setRotate(START - 10, cx, cy);
        g.setLocalMatrix(m);
        arc.setShader(g);
        arc.setStrokeWidth(stroke);
        if (ratio > 0.002f) canvas.drawArc(oval, START, SWEEP * ratio, false, arc);

        // шкала белгілері
        float inner = r - stroke * 1.1f, outer = r - stroke * 0.7f;
        for (int i = 0; i <= 10; i++) {
            double a = Math.toRadians(START + SWEEP * i / 10f);
            canvas.drawLine(cx + (float) Math.cos(a) * inner, cy + (float) Math.sin(a) * inner,
                    cx + (float) Math.cos(a) * outer, cy + (float) Math.sin(a) * outer, tick);
        }

        big.setTextSize(size * 0.17f);
        big.setColor(over ? 0xFFEF4444 : UiUtil.themeColor(getContext(), com.google.android.material.R.attr.colorOnSurface));
        canvas.drawText(Fmt.integer(shown), cx, cy + size * 0.03f, big);
        small.setTextSize(size * 0.065f);
        canvas.drawText("Вт қосулы", cx, cy + size * 0.13f, small);
        small.setTextSize(size * 0.058f);
        canvas.drawText(Fmt.percent(100f * shown / max) + " · шегі " + Fmt.watts(max), cx, cy + size * 0.3f, small);
    }
}
