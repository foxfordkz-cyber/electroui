package com.example.electroui.fragments;

import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.GridLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.electroui.R;
import com.example.electroui.data.NotificationRepository;
import com.example.electroui.data.UserRepository;
import com.example.electroui.model.Apartment;
import com.example.electroui.model.AppNotification;
import com.example.electroui.model.User;
import com.example.electroui.ui.StatTiles;
import com.example.electroui.util.DataBus;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.ThemeManager;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.textfield.TextInputEditText;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Әкімші: пайдаланушылар тізімі, рөл беру, бұғаттау, жою. */
public class AdminUsersFragment extends BaseFragment {
    private final List<User> shown = new ArrayList<>();
    private RecyclerView.Adapter<RecyclerView.ViewHolder> adapter;
    private GridLayout stats;
    private TextInputEditText filter;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_admin_users, container, false);
        stats = v.findViewById(R.id.stats);
        filter = v.findViewById(R.id.filter);
        RecyclerView list = v.findViewById(R.id.list);
        list.setLayoutManager(new LinearLayoutManager(requireContext()));
        adapter = new RecyclerView.Adapter<RecyclerView.ViewHolder>() {
            @NonNull
            @Override
            public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int type) {
                return new RecyclerView.ViewHolder(LayoutInflater.from(parent.getContext()).inflate(R.layout.item_user, parent, false)) { };
            }

            @Override
            public void onBindViewHolder(@NonNull RecyclerView.ViewHolder h, int pos) {
                bind(h.itemView, shown.get(pos));
            }

            @Override
            public int getItemCount() {
                return shown.size();
            }
        };
        list.setAdapter(adapter);
        filter.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void afterTextChanged(Editable s) { onDataChanged(); }
        });
        return v;
    }

    private void bind(View v, User u) {
        TextView avatar = v.findViewById(R.id.avatar);
        avatar.setText(u.initials());
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(ThemeManager.ACCENT_COLORS[(int) (u.id % ThemeManager.ACCENT_COLORS.length)]);
        avatar.setBackground(circle);
        ((TextView) v.findViewById(R.id.name)).setText(u.fullName + (u.id == uid() ? " (сіз)" : ""));
        ((TextView) v.findViewById(R.id.sub)).setText("@" + u.login + " · " + u.email);
        Apartment a = repo().load(u.id);
        ((TextView) v.findViewById(R.id.power)).setText(a.getAppliances().size() + " құрал · розеткада "
                + Fmt.watts(a.pluggedPower()) + " · тіркелді " + Fmt.ago(u.createdAt));
        TextView role = v.findViewById(R.id.role);
        role.setText(u.roleTitle());
        GradientDrawable pill = new GradientDrawable();
        pill.setCornerRadius(100);
        pill.setColor(u.isAdmin() ? 0xFF7C4DFF : 0xFF2F6BFF);
        role.setBackground(pill);
        v.findViewById(R.id.blocked).setVisibility(u.blocked ? View.VISIBLE : View.GONE);
        v.setAlpha(u.blocked ? 0.6f : 1f);
        v.setOnClickListener(x -> actions(u));
    }

    private void actions(User u) {
        if (u.id == uid()) {
            main().snack("Өз аккаунтыңыздың рөлін өзгертуге немесе жоюға болмайды");
            return;
        }
        String[] options = {
                u.isAdmin() ? "Клиент рөлін беру" : "Әкімші рөлін беру",
                u.blocked ? "Бұғаттан шығару" : "Бұғаттау",
                "Жеке хабарлама жіберу",
                "Аккаунтты жою"};
        UserRepository users = new UserRepository(requireContext());
        new MaterialAlertDialogBuilder(requireContext())
                .setTitle(u.fullName + " (@" + u.login + ")")
                .setItems(options, (d, which) -> {
                    switch (which) {
                        case 0:
                            users.setRole(u.id, u.isAdmin() ? User.CLIENT : User.ADMIN);
                            new NotificationRepository(requireContext()).add(u.id, "Рөліңіз өзгерді",
                                    "Әкімші сізге «" + (u.isAdmin() ? "Клиент" : "Әкімші") + "» рөлін берді.", AppNotification.ADMIN);
                            main().snack("Рөл өзгертілді");
                            break;
                        case 1:
                            users.setBlocked(u.id, !u.blocked);
                            main().snack(u.blocked ? "Бұғаттан шығарылды" : "Пайдаланушы бұғатталды — ол жүйеге кіре алмайды");
                            break;
                        case 2:
                            new NotificationRepository(requireContext()).add(u.id, "Әкімшіден хабарлама",
                                    "Сәлем, " + u.firstName() + "! Пәтеріңіздегі қуатты құралдарды қараусыз қалдырмаңыз.",
                                    AppNotification.ADMIN);
                            main().snack("Хабарлама жіберілді");
                            break;
                        default:
                            new MaterialAlertDialogBuilder(requireContext())
                                    .setTitle("Аккаунтты жою")
                                    .setMessage("@" + u.login + " аккаунты, оның бөлмелері, құралдары және хабарламалары толық жойылады. Бұл әрекетті қайтару мүмкін емес.")
                                    .setNegativeButton("Жоқ", null)
                                    .setPositiveButton("Жою", (x, y) -> {
                                        users.delete(u.id);
                                        main().snack("Аккаунт жойылды");
                                        DataBus.changed();
                                    })
                                    .show();
                            return;
                    }
                    DataBus.changed();
                })
                .show();
    }

    @Override
    protected void onDataChanged() {
        UserRepository users = new UserRepository(requireContext());
        List<User> all = users.all();
        String q = filter.getText() == null ? "" : filter.getText().toString().trim().toLowerCase(Locale.ROOT);
        shown.clear();
        int blocked = 0;
        for (User u : all) {
            if (u.blocked) blocked++;
            if (q.isEmpty() || (u.fullName + " " + u.login + " " + u.email).toLowerCase(Locale.ROOT).contains(q)) shown.add(u);
        }
        adapter.notifyDataSetChanged();
        StatTiles.clear(stats);
        StatTiles.add(stats, R.drawable.ic_group, String.valueOf(all.size()), "Барлық пайдаланушы");
        StatTiles.add(stats, R.drawable.ic_badge, users.count(User.ADMIN) + " / " + users.count(User.CLIENT), "Әкімші / клиент");
    }
}
