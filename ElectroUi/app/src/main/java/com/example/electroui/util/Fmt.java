package com.example.electroui.util;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Сандарды қазақша пішімдеу: 2 470 Вт, 5,23 кВт·сағ, 3 921 ₸. */
public final class Fmt {
    private static final DecimalFormatSymbols SYMBOLS = new DecimalFormatSymbols(Locale.US);

    static {
        SYMBOLS.setGroupingSeparator(' ');
        SYMBOLS.setDecimalSeparator(',');
    }

    private Fmt() {
    }

    private static String pattern(double v, String p) {
        return new DecimalFormat(p, SYMBOLS).format(v);
    }

    public static String integer(double v) {
        return pattern(Math.round(v), "#,##0");
    }

    public static String dec(double v, int digits) {
        StringBuilder p = new StringBuilder("#,##0");
        if (digits > 0) p.append('.');
        for (int i = 0; i < digits; i++) p.append('0');
        return pattern(v, p.toString());
    }

    /** 1,5 → "1,5"; 2,0 → "2". */
    public static String num(double v) {
        return pattern(v, "#,##0.##");
    }

    public static String watts(double w) {
        return integer(w) + " Вт";
    }

    public static String kw(double w) {
        return dec(w / 1000.0, 2) + " кВт";
    }

    public static String kwh(double v) {
        return dec(v, 2) + " кВт·сағ";
    }

    public static String tenge(double v) {
        return integer(v) + " ₸";
    }

    public static String amps(double v) {
        return dec(v, 1) + " А";
    }

    public static String percent(double v) {
        return integer(v) + "%";
    }

    public static String date(long millis) {
        return new SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.US).format(new Date(millis));
    }

    public static String ago(long millis) {
        long d = (System.currentTimeMillis() - millis) / 1000;
        if (d < 60) return "қазір ғана";
        if (d < 3600) return (d / 60) + " мин бұрын";
        if (d < 86400) return (d / 3600) + " сағ бұрын";
        if (d < 172800) return "кеше";
        return new SimpleDateFormat("dd.MM.yyyy", Locale.US).format(new Date(millis));
    }

    public static String action(String code) {
        switch (code) {
            case "PLUG": return "розеткаға қосылды";
            case "UNPLUG": return "ажыратылды";
            case "ADD": return "пәтерге қосылды";
            case "DELETE": return "жойылды";
            case "UNPLUG_ALL": return "барлығы ажыратылды";
            default: return code;
        }
    }
}
