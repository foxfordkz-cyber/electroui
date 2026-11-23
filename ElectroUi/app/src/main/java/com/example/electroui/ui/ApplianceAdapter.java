package com.example.electroui.ui;

import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.electroui.R;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.Images;
import com.google.android.material.materialswitch.MaterialSwitch;

import java.util.ArrayList;
import java.util.List;

/** Құралдар тізімі (RecyclerView). Ауыстырғыш — розеткаға қосу/ажырату. */
public class ApplianceAdapter extends RecyclerView.Adapter<ApplianceAdapter.Holder> {
    public interface Listener {
        void onClick(ElectricAppliance a);

        void onPlug(ElectricAppliance a, boolean on);
    }

    private final List<ElectricAppliance> items = new ArrayList<>();
    private final Listener listener;
    private final boolean showSwitch;
    private final boolean showRank;
    private final boolean showRoom;

    public ApplianceAdapter(Listener listener, boolean showSwitch, boolean showRank, boolean showRoom) {
        this.listener = listener;
        this.showSwitch = showSwitch;
        this.showRank = showRank;
        this.showRoom = showRoom;
    }

    public void submit(List<ElectricAppliance> list) {
        items.clear();
        items.addAll(list);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        return new Holder(LayoutInflater.from(parent.getContext()).inflate(R.layout.item_appliance, parent, false));
    }

    @Override
    public void onBindViewHolder(@NonNull Holder h, int position) {
        ElectricAppliance a = items.get(position);
        h.image.setImageResource(Images.forType(a.type()));
        h.name.setText(a.getName());
        String sub = a.typeName() + (showRoom && !a.getRoomName().isEmpty() ? " · " + a.getRoomName() : "")
                + " · " + Fmt.num(a.getHoursPerDay()) + " сағ/тәул.";
        h.sub.setText(sub);
        h.power.setText(Fmt.watts(a.getPower()));
        h.energy.setText(a.getEnergyClass());
        GradientDrawable badge = new GradientDrawable();
        badge.setCornerRadius(100f);
        badge.setColor(energyColor(a.getEnergyClass()));
        h.energy.setBackground(badge);
        boolean on = a.isPluggedIn();
        h.stripe.setBackgroundResource(on ? R.drawable.bg_stripe_on : R.drawable.bg_stripe_off);
        h.bolt.setVisibility(on ? View.VISIBLE : View.GONE);
        h.image.setAlpha(on || !showSwitch ? 1f : 0.75f);
        h.rank.setVisibility(showRank ? View.VISIBLE : View.GONE);
        h.rank.setText(String.valueOf(position + 1));

        h.plug.setVisibility(showSwitch ? View.VISIBLE : View.GONE);
        h.plug.setOnCheckedChangeListener(null);
        h.plug.setChecked(on);
        h.plug.setOnCheckedChangeListener((b, checked) -> {
            if (checked != a.isPluggedIn()) listener.onPlug(a, checked);
        });
        h.itemView.setOnClickListener(v -> listener.onClick(a));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    /** A+++ (жасыл) … D (қызыл). */
    public static int energyColor(String cls) {
        switch (cls) {
            case "A+++": return 0xFF0E9F4F;
            case "A++": return 0xFF22B35E;
            case "A+": return 0xFF65B82E;
            case "A": return 0xFF9BBF1E;
            case "B": return 0xFFE0A800;
            case "C": return 0xFFF07B1F;
            default: return 0xFFE5484D;
        }
    }

    static class Holder extends RecyclerView.ViewHolder {
        final ImageView image, bolt;
        final TextView name, sub, power, energy, rank;
        final View stripe;
        final MaterialSwitch plug;

        Holder(View v) {
            super(v);
            image = v.findViewById(R.id.image);
            bolt = v.findViewById(R.id.bolt);
            name = v.findViewById(R.id.name);
            sub = v.findViewById(R.id.sub);
            power = v.findViewById(R.id.power);
            energy = v.findViewById(R.id.energy);
            rank = v.findViewById(R.id.rank);
            stripe = v.findViewById(R.id.stripe);
            plug = v.findViewById(R.id.plug);
        }
    }
}
