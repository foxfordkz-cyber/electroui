package com.example.electroui.model;

/** Пәтердегі бөлме: атауы және розеткалар саны. */
public class Room {
    private final long id;
    private final String name;
    private final int sockets;

    public Room(long id, String name, int sockets) {
        this.id = id;
        this.name = name;
        this.sockets = sockets;
    }

    public long getId() { return id; }
    public String getName() { return name; }
    public int getSockets() { return sockets; }

    @Override
    public String toString() {
        return name;
    }
}
