package com.example.electroui.fragments;

import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.recyclerview.widget.ItemTouchHelper;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.electroui.R;
import com.example.electroui.data.NotificationRepository;
import com.example.electroui.model.Apartment;
import com.example.electroui.model.AppNotification;
import com.example.electroui.util.Alerts;
import com.example.electroui.util.DataBus;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.Notifier;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import java.util.ArrayList;
import java.util.List;

/** Хабарламалар тізімі: оқу, жою (солға сырғыту), барлығын тазалау. */
public class NotificationsFragment extends BaseFragment {
    private final List<AppNotification> items = new ArrayList<>();
    private RecyclerView.Adapter<RecyclerView.ViewHolder> adapter;
    private TextView summary, empty;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_notifications, container, false);
        summary = v.findViewById(R.id.summary);
        empty = v.findViewById(R.id.empty);
        RecyclerView list = v.findViewById(R.id.list);
        list.setLayoutManager(new LinearLayoutManager(requireContext()));
        adapter = new RecyclerView.Adapter<RecyclerView.ViewHolder>() {
            @NonNull
            @Override
            public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
                return new RecyclerView.ViewHolder(LayoutInflater.from(parent.getContext())
                        .inflate(R.layout.item_notification, parent, false)) { };
            }

            @Override
            public void onBindViewHolder(@NonNull RecyclerView.ViewHolder h, int position) {
                bind(h.itemView, items.get(position));
            }

            @Override
            public int getItemCount() {
                return items.size();
            }
        };
        list.setAdapter(adapter);
        new ItemTouchHelper(new ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.LEFT | ItemTouchHelper.RIGHT) {
            @Override
            public boolean onMove(@NonNull RecyclerView rv, @NonNull RecyclerView.ViewHolder a, @NonNull RecyclerView.ViewHolder b) {
                return false;
            }

            @Override
            public void onSwiped(@NonNull RecyclerView.ViewHolder h, int direction) {
                AppNotification n = items.get(h.getBindingAdapterPosition());
                new NotificationRepository(requireContext()).delete(n.id);
                main().snack("Хабарлама жойылды");
                DataBus.changed();
            }
        }).attachToRecyclerView(list);

        v.findViewById(R.id.btn_read_all).setOnClickListener(b -> {
            new NotificationRepository(requireContext()).markAllRead(uid());
            DataBus.changed();
        });
        v.findViewById(R.id.btn_clear).setOnClickListener(b -> new MaterialAlertDialogBuilder(requireContext())
                .setTitle("Барлық хабарламаны жою")
                .setMessage("Хабарламалар тізімі толық тазаланады. Жалғастырасыз ба?")
                .setNegativeButton("Жоқ", null)
                .setPositiveButton("Жою", (d, w) -> {
                    new NotificationRepository(requireContext()).clear(uid());
                    DataBus.changed();
                })
                .show());
        v.findViewById(R.id.btn_test).setOnClickListener(b -> {
            Apartment a = repo().load(uid());
            if (!Notifier.permissionGranted(requireContext()))
                main().snack("Хабарламаларға рұқсат берілмеген — тек тізімге жазылады");
            Alerts.push(requireContext(), uid(), "Қуат есебі",
                    "Қазір розеткада " + a.plugged().size() + " құрал, жалпы " + Fmt.watts(a.pluggedPower())
                            + ". Айлық төлем ≈ " + Fmt.tenge(a.monthlyCost(settings().tariff())) + ".",
                    AppNotification.INFO, true);
        });
        return v;
    }

    private void bind(View v, AppNotification n) {
        int color;
        int icon;
        switch (n.kind) {
            case AppNotification.WARNING: color = 0xFFE5484D; icon = R.drawable.ic_warning; break;
            case AppNotification.SUCCESS: color = 0xFF16A34A; icon = R.drawable.ic_check; break;
            case AppNotification.ADMIN: color = 0xFF7C4DFF; icon = R.drawable.ic_campaign; break;
            default: color = 0xFF2F6BFF; icon = R.drawable.ic_info;
        }
        ImageView img = v.findViewById(R.id.icon);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(color);
        img.setBackground(bg);
        img.setImageResource(icon);
        img.setColorFilter(0xFFFFFFFF);
        ((TextView) v.findViewById(R.id.title)).setText(n.title);
        ((TextView) v.findViewById(R.id.body)).setText(n.body);
        ((TextView) v.findViewById(R.id.time)).setText(Fmt.ago(n.createdAt) + " · " + Fmt.date(n.createdAt)
                + (AppNotification.ADMIN.equals(n.kind) ? " · әкімшіден" : ""));
        v.findViewById(R.id.unread).setVisibility(n.read ? View.GONE : View.VISIBLE);
        v.setAlpha(n.read ? 0.75f : 1f);
        v.setOnClickListener(x -> {
            if (!n.read) {
                new NotificationRepository(requireContext()).markRead(n.id);
                DataBus.changed();
            }
        });
    }

    @Override
    protected void onDataChanged() {
        NotificationRepository repo = new NotificationRepository(requireContext());
        items.clear();
        items.addAll(repo.list(uid()));
        adapter.notifyDataSetChanged();
        int unread = repo.unread(uid());
        summary.setText(items.size() + " хабарлама" + (unread > 0 ? " · " + unread + " жаңа" : ""));
        empty.setVisibility(items.isEmpty() ? View.VISIBLE : View.GONE);
    }
}
