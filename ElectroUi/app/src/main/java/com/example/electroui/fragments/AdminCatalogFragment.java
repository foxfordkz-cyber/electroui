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
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.ui.ApplianceAdapter;
import com.example.electroui.util.DataBus;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import java.util.List;

/** Әкімші: құралдар каталогы (клиенттер пәтерге қосқанда осы үлгілерді таңдайды). CRUD. */
public class AdminCatalogFragment extends BaseFragment {
    private ApplianceAdapter adapter;
    private TextView summary;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_admin_catalog, container, false);
        summary = v.findViewById(R.id.summary);
        RecyclerView list = v.findViewById(R.id.list);
        list.setLayoutManager(new LinearLayoutManager(requireContext()));
        adapter = new ApplianceAdapter(new ApplianceAdapter.Listener() {
            @Override
            public void onClick(ElectricAppliance a) {
                new MaterialAlertDialogBuilder(requireContext())
                        .setTitle(a.getName())
                        .setMessage(a.typeName() + " · " + a.getBrand() + "\n" + a.describe())
                        .setNeutralButton("Жою", (d, w) -> new MaterialAlertDialogBuilder(requireContext())
                                .setTitle("Каталогтан жою")
                                .setMessage("«" + a.getName() + "» үлгісі каталогтан жойылады. Клиенттердің пәтеріндегі құралдар сақталады.")
                                .setNegativeButton("Жоқ", null)
                                .setPositiveButton("Жою", (x, y) -> {
                                    repo().deleteCatalog(a.getId());
                                    main().snack("Каталогтан жойылды");
                                    DataBus.changed();
                                })
                                .show())
                        .setNegativeButton("Жабу", null)
                        .setPositiveButton("Өзгерту", (d, w) -> startActivity(new Intent(requireContext(), ApplianceFormActivity.class)
                                .putExtra(ApplianceFormActivity.EXTRA_CATALOG_ID, a.getId())))
                        .show();
            }

            @Override
            public void onPlug(ElectricAppliance a, boolean on) {
            }
        }, false, false, false);
        list.setAdapter(adapter);
        v.findViewById(R.id.fab).setOnClickListener(b -> startActivity(new Intent(requireContext(), ApplianceFormActivity.class)
                .putExtra(ApplianceFormActivity.EXTRA_CATALOG_MODE, true)));
        return v;
    }

    @Override
    protected void onDataChanged() {
        List<ElectricAppliance> items = repo().catalog();
        adapter.submit(items);
        summary.setText("Каталогта " + items.size() + " үлгі. Клиент «Құрал қосу» кезінде осы тізімнен таңдап, өрістерді автоматты толтырады.");
    }
}
