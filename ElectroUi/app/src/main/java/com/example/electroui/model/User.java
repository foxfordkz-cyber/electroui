package com.example.electroui.model;

/** Жүйе пайдаланушысы. Рөлі: ADMIN (әкімші) немесе CLIENT (клиент). */
public class User {
    public static final String ADMIN = "ADMIN";
    public static final String CLIENT = "CLIENT";

    public final long id;
    public final String login;
    public final String fullName;
    public final String email;
    public final String role;
    public final boolean blocked;
    public final long createdAt;

    public User(long id, String login, String fullName, String email, String role, boolean blocked, long createdAt) {
        this.id = id;
        this.login = login;
        this.fullName = fullName;
        this.email = email;
        this.role = role;
        this.blocked = blocked;
        this.createdAt = createdAt;
    }

    public boolean isAdmin() {
        return ADMIN.equals(role);
    }

    public String roleTitle() {
        return isAdmin() ? "Әкімші" : "Клиент";
    }

    public String firstName() {
        String[] parts = fullName.trim().split("\\s+");
        return parts.length == 0 || parts[0].isEmpty() ? login : parts[0];
    }

    public String initials() {
        String[] parts = fullName.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (!p.isEmpty()) sb.appendCodePoint(Character.toUpperCase(p.codePointAt(0)));
            if (sb.length() >= 2) break;
        }
        return sb.length() == 0 ? login.substring(0, 1).toUpperCase() : sb.toString();
    }
}
