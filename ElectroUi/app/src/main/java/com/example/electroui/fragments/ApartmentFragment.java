package com.example.electroui.fragments;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.electroui.ApplianceFormActivity;
import com.example.electroui.R;
import com.example.electroui.model.Apartment;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.model.Room;
import com.example.electroui.ui.ApplianceAdapter;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.UiUtil;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton;

import java.util.List;

/** 2-тапсырма: құралдарды розеткаға қосу. Бөлмелер бойынша сүзгі, бос розеткалар саны. */
public class ApartmentFragment extends BaseFragment {
    private ChipGroup rooms;
    private TextView summaryTitle, summarySub, sockets, empty;
    private ApplianceAdapter adapter;
    private long selectedRoom;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_apartment, container, false);
        rooms = v.findViewById(R.id.rooms);
        summaryTitle = v.findViewById(R.id.summary_title);
        summarySub = v.findViewById(R.id.summary_sub);
        sockets = v.findViewById(R.id.sockets);
        empty = v.findViewById(R.id.empty);
        RecyclerView list = v.findViewById(R.id.list);
        list.setLayoutManager(new LinearLayoutManager(requireContext()));
        adapter = new ApplianceAdapter(new ApplianceAdapter.Listener() {
            @Override
            public void onClick(ElectricAppliance a) {
                showDetails(a);
            }

            @Override
            public void onPlug(ElectricAppliance a, boolean on) {
                plug(a, on);
            }
        }, true, false, true);
        list.setAdapter(adapter);

        ExtendedFloatingActionButton fab = v.findViewById(R.id.fab);
        fab.setOnClickListener(b -> startActivity(new Intent(requireContext(), ApplianceFormActivity.class)
                .putExtra(ApplianceFormActivity.EXTRA_ROOM, selectedRoom)));
        list.addOnScrollListener(new RecyclerView.OnScrollListener() {
            @Override
            public void onScrolled(@NonNull RecyclerView rv, int dx, int dy) {
                if (dy > 6) fab.shrink();
                else if (dy < -6) fab.extend();
            }
        });
        rooms.setOnCheckedStateChangeListener((group, ids) -> {
            if (ids.isEmpty()) return;
            Object tag = group.findViewById(ids.get(0)).getTag();
            selectedRoom = tag == null ? 0 : (Long) tag;
            onDataChanged();
        });
        UiUtil.fadeUp(v.findViewById(R.id.summary_card), 0);
        return v;
    }

    @Override
    protected void onDataChanged() {
        Apartment a = repo().load(uid());
        summaryTitle.setText("Розеткада " + a.plugged().size() + " құрал · " + Fmt.watts(a.pluggedPower()));
        summarySub.setText("Пәтерде " + a.getAppliances().size() + " құрал, " + a.totalSockets()
                + " розетка. Ауыстырғышты басып қосыңыз/ажыратыңыз");

        // бөлме чиптері: «Ас үй · 2/4»
        rebuildChips(a);

        List<ElectricAppliance> list = selectedRoom == 0 ? a.getAppliances() : a.inRoom(selectedRoom);
        adapter.submit(list);
        empty.setVisibility(list.isEmpty() ? View.VISIBLE : View.GONE);
        if (selectedRoom == 0) {
            sockets.setText("Барлық бөлме: бос розетка — " + (a.totalSockets() - a.plugged().size()) + " / " + a.totalSockets());
        } else {
            Room r = a.room(selectedRoom);
            StringBuilder dots = new StringBuilder();
            for (int i = 0; i < r.getSockets(); i++) dots.append(i < a.usedSockets(r.getId()) ? "● " : "○ ");
            sockets.setText(r.getName() + ": " + dots + " (" + a.freeSockets(r.getId()) + " бос) · "
                    + Fmt.watts(a.roomPower(r.getId())) + " / " + Fmt.watts(settings().roomLimit()));
        }
    }

    private void rebuildChips(Apartment a) {
        rooms.setOnCheckedStateChangeListener(null);
        rooms.removeAllViews();
        addChip("Барлығы · " + a.getAppliances().size(), 0L);
        for (Room r : a.getRooms())
            addChip(r.getName() + " · " + a.usedSockets(r.getId()) + "/" + r.getSockets(), r.getId());
        for (int i = 0; i < rooms.getChildCount(); i++) {
            Chip c = (Chip) rooms.getChildAt(i);
            if ((Long) c.getTag() == selectedRoom) c.setChecked(true);
        }
        rooms.setOnCheckedStateChangeListener((group, ids) -> {
            if (ids.isEmpty()) return;
            selectedRoom = (Long) group.findViewById(ids.get(0)).getTag();
            onDataChanged();
        });
    }

    private void addChip(String text, long roomId) {
        Chip chip = (Chip) LayoutInflater.from(requireContext()).inflate(R.layout.chip_filter, rooms, false);
        chip.setId(View.generateViewId());
        chip.setText(text);
        chip.setTag(roomId);
        rooms.addView(chip);
    }
}
