package com.example.electroui.model;

/** Розеткаға қосылатын кез келген құрылғының келісімі (интерфейс). */
public interface Pluggable {
    void plugIn();

    void unplug();

    boolean isPluggedIn();
}
