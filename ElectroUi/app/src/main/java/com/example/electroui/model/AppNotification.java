package com.example.electroui.model;

/** Қосымша ішіндегі хабарлама (дерекқордағы notifications кестесінің жолы). */
public class AppNotification {
    public static final String INFO = "INFO";
    public static final String SUCCESS = "SUCCESS";
    public static final String WARNING = "WARNING";
    public static final String ADMIN = "ADMIN";

    public final long id;
    public final String title;
    public final String body;
    public final String kind;
    public final boolean read;
    public final long createdAt;

    public AppNotification(long id, String title, String body, String kind, boolean read, long createdAt) {
        this.id = id;
        this.title = title;
        this.body = body;
        this.kind = kind;
        this.read = read;
        this.createdAt = createdAt;
    }
}
