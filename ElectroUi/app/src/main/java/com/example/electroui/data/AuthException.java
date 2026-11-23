package com.example.electroui.data;

/** Тіркелу / кіру қатесі. field — қай өріске қатысты екені (экранда қызылмен көрсету үшін). */
public class AuthException extends Exception {
    public static final int GENERAL = 0;
    public static final int NAME = 1;
    public static final int LOGIN = 2;
    public static final int EMAIL = 3;
    public static final int PASSWORD = 4;
    public static final int CONFIRM = 5;

    public final int field;

    public AuthException(int field, String message) {
        super(message);
        this.field = field;
    }
}
