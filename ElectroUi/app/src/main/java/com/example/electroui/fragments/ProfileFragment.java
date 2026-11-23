package com.example.electroui.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.GridLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.example.electroui.R;
import com.example.electroui.data.AuthException;
import com.example.electroui.data.UserRepository;
import com.example.electroui.model.Apartment;
import com.example.electroui.model.User;
import com.example.electroui.ui.StatTiles;
import com.example.electroui.util.DataBus;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.UiUtil;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

/** Профиль: жеке деректер, құпиясөзді өзгерту (ескі хэшті тексеріп), шығу. */
public class ProfileFragment extends BaseFragment {
    private TextView avatar, name, login, role, hash;
    private GridLayout stats;
    private TextInputEditText inName, inEmail, inOld, inNew, inConfirm;
    private TextInputLayout lName, lEmail, lOld, lNew, lConfirm;
    private boolean filled;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_profile, container, false);
        avatar = v.findViewById(R.id.avatar);
        name = v.findViewById(R.id.name);
        login = v.findViewById(R.id.login);
        role = v.findViewById(R.id.role);
        hash = v.findViewById(R.id.hash);
        stats = v.findViewById(R.id.stats);
        inName = v.findViewById(R.id.input_name);
        inEmail = v.findViewById(R.id.input_email);
        inOld = v.findViewById(R.id.input_old);
        inNew = v.findViewById(R.id.input_new);
        inConfirm = v.findViewById(R.id.input_confirm);
        lName = v.findViewById(R.id.name_layout);
        lEmail = v.findViewById(R.id.email_layout);
        lOld = v.findViewById(R.id.old_layout);
        lNew = v.findViewById(R.id.new_layout);
        lConfirm = v.findViewById(R.id.confirm_layout);

        v.findViewById(R.id.btn_save).setOnClickListener(b -> {
            lName.setError(null);
            lEmail.setError(null);
            try {
                new UserRepository(requireContext()).updateProfile(uid(), str(inName), str(inEmail));
                main().snack("Профиль сақталды");
                DataBus.changed();
            } catch (AuthException e) {
                (e.field == AuthException.EMAIL ? lEmail : lName).setError(e.getMessage());
            }
        });
        v.findViewById(R.id.btn_password).setOnClickListener(b -> {
            lOld.setError(null);
            lNew.setError(null);
            lConfirm.setError(null);
            try {
                new UserRepository(requireContext()).changePassword(uid(), str(inOld), str(inNew), str(inConfirm));
                inOld.setText("");
                inNew.setText("");
                inConfirm.setText("");
                main().snack("Құпиясөз жаңартылды — жаңа тұз бен хэш жазылды");
                DataBus.changed();
            } catch (AuthException e) {
                if (e.field == AuthException.PASSWORD) lNew.setError(e.getMessage());
                else if (e.field == AuthException.CONFIRM) lConfirm.setError(e.getMessage());
                else lOld.setError(e.getMessage());
            }
        });
        v.findViewById(R.id.btn_logout).setOnClickListener(b -> main().open(R.id.nav_logout));
        UiUtil.fadeUp(v.findViewById(R.id.head), 0);
        UiUtil.pop(avatar, 150);
        return v;
    }

    private static String str(TextInputEditText e) {
        return e.getText() == null ? "" : e.getText().toString();
    }

    @Override
    protected void onDataChanged() {
        User u = new UserRepository(requireContext()).byId(uid());
        if (u == null) return;
        avatar.setText(u.initials());
        name.setText(u.fullName);
        login.setText("@" + u.login + " · " + u.email);
        role.setText(u.roleTitle() + " · тіркелген " + Fmt.date(u.createdAt));
        if (!filled) {
            inName.setText(u.fullName);
            inEmail.setText(u.email);
            filled = true;
        }
        hash.setText(new UserRepository(requireContext()).hashPreview(u.id));
        Apartment a = repo().load(u.id);
        StatTiles.clear(stats);
        StatTiles.add(stats, R.drawable.ic_room, String.valueOf(a.getRooms().size()), "Бөлме");
        StatTiles.add(stats, R.drawable.ic_plug, a.totalSockets() + " розетка", "Барлық розеткалар");
        StatTiles.add(stats, R.drawable.ic_category, String.valueOf(a.getAppliances().size()), "Құралдар");
        StatTiles.add(stats, R.drawable.ic_bolt, Fmt.watts(a.installedPower()), "Орнатылған қуат");
    }
}
