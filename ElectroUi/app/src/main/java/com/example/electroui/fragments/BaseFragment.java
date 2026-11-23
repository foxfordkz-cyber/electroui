package com.example.electroui.fragments;

import android.content.Intent;

import androidx.fragment.app.Fragment;

import com.example.electroui.ApplianceFormActivity;
import com.example.electroui.MainActivity;
import com.example.electroui.data.ApplianceRepository;
import com.example.electroui.data.SettingsRepository;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.model.PlugResult;
import com.example.electroui.model.User;
import com.example.electroui.ui.ApplianceSheet;
import com.example.electroui.util.Alerts;
import com.example.electroui.util.DataBus;

/** Барлық фрагменттерге ортақ: ағымдағы пайдаланушы, репозиторийлер, деректер өзгергенде жаңару. */
public abstract class BaseFragment extends Fragment {
    private final Runnable listener = () -> {
        if (isAdded() && getView() != null) onDataChanged();
    };

    protected MainActivity main() {
        return (MainActivity) requireActivity();
    }

    protected User user() {
        return main().user();
    }

    protected long uid() {
        return user().id;
    }

    protected ApplianceRepository repo() {
        return new ApplianceRepository(requireContext());
    }

    protected SettingsRepository settings() {
        return new SettingsRepository(requireContext());
    }

    /** Деректер өзгерді (басқа экранда, 3D көріністе т.б.) — экранды жаңарту. */
    protected void onDataChanged() {
    }

    @Override
    public void onStart() {
        super.onStart();
        DataBus.register(listener);
    }

    @Override
    public void onStop() {
        super.onStop();
        DataBus.unregister(listener);
    }

    @Override
    public void onResume() {
        super.onResume();
        onDataChanged();
    }

    /** Розеткаға қосу/ажырату — нәтижесін Snackbar-мен көрсетеді. */
    protected PlugResult plug(ElectricAppliance a, boolean on) {
        PlugResult r = Alerts.plug(requireContext(), uid(), a.getId(), on);
        if (!r.ok) main().snack(r.message);
        else if (r.apartmentOverload || r.roomOverload) main().snack("⚠ Шамадан тыс жүктеме! Хабарламаларды қараңыз");
        return r;
    }

    protected void showDetails(ElectricAppliance a) {
        ApplianceSheet.show(this, a, new ApplianceSheet.Callbacks() {
            @Override
            public void onPlug(ElectricAppliance item, boolean on) {
                plug(item, on);
            }

            @Override
            public void onEdit(ElectricAppliance item) {
                startActivity(new Intent(requireContext(), ApplianceFormActivity.class)
                        .putExtra(ApplianceFormActivity.EXTRA_ID, item.getId()));
            }

            @Override
            public void onDelete(ElectricAppliance item) {
                repo().delete(uid(), item.getId());
                main().snack("«" + item.getName() + "» пәтерден жойылды");
                DataBus.changed();
            }
        });
    }
}
