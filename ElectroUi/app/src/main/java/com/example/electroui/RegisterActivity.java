package com.example.electroui;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.TextView;

import com.example.electroui.data.AuthException;
import com.example.electroui.data.PasswordHasher;
import com.example.electroui.data.Session;
import com.example.electroui.data.UserRepository;
import com.example.electroui.model.AppNotification;
import com.example.electroui.model.User;
import com.example.electroui.util.Notifier;
import com.example.electroui.util.UiUtil;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.progressindicator.LinearProgressIndicator;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Тіркелу: өрістерді тексеру, құпиясөзді хэштеу, клиент рөлімен аккаунт ашу. */
public class RegisterActivity extends BaseActivity {
    private static final String[] STRENGTH = {"Өте әлсіз", "Әлсіз", "Орташа", "Жақсы", "Өте берік"};
    private static final int[] STRENGTH_COLORS = {0xFFE5484D, 0xFFF97316, 0xFFF59E0B, 0xFF84CC16, 0xFF16A34A};

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private TextInputLayout nameL, loginL, emailL, passL, confirmL;
    private TextInputEditText name, login, email, pass, confirm;
    private MaterialButton button;
    private View progress, card;
    private TextView error;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);
        UiUtil.insets(findViewById(R.id.content), true, true);

        nameL = findViewById(R.id.name_layout);
        loginL = findViewById(R.id.login_layout);
        emailL = findViewById(R.id.email_layout);
        passL = findViewById(R.id.password_layout);
        confirmL = findViewById(R.id.confirm_layout);
        name = findViewById(R.id.input_name);
        login = findViewById(R.id.input_login);
        email = findViewById(R.id.input_email);
        pass = findViewById(R.id.input_password);
        confirm = findViewById(R.id.input_confirm);
        button = findViewById(R.id.btn_register);
        progress = findViewById(R.id.progress);
        error = findViewById(R.id.error);
        card = findViewById(R.id.card);
        UiUtil.fadeUp(findViewById(R.id.headline), 0);
        UiUtil.fadeUp(card, 120);

        LinearProgressIndicator strength = findViewById(R.id.strength);
        TextView strengthText = findViewById(R.id.strength_text);
        pass.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { }

            @Override
            public void afterTextChanged(Editable s) {
                int score = PasswordHasher.strength(s.toString());
                strength.setProgressCompat(Math.max(score, s.length() > 0 ? 1 : 0), true);
                strength.setIndicatorColor(STRENGTH_COLORS[score]);
                strengthText.setText(s.length() == 0 ? "Құпиясөз беріктігі" : "Беріктігі: " + STRENGTH[score]);
                strengthText.setTextColor(STRENGTH_COLORS[score]);
            }
        });

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        findViewById(R.id.btn_to_login).setOnClickListener(v -> finish());
        button.setOnClickListener(v -> attempt());
    }

    private void attempt() {
        for (TextInputLayout l : new TextInputLayout[]{nameL, loginL, emailL, passL, confirmL}) l.setError(null);
        loginL.setHelperText("3–20 таңба: латын әрпі, сан, _");
        error.setVisibility(View.GONE);
        String n = LoginActivity.text(name), l = LoginActivity.text(login).trim(), e = LoginActivity.text(email),
                p = LoginActivity.text(pass), c = LoginActivity.text(confirm);
        button.setEnabled(false);
        progress.setVisibility(View.VISIBLE);
        io.execute(() -> {
            try {
                User u = new UserRepository(this).register(n, l, e, p, c);
                main.post(() -> {
                    Session.start(this, u.id);
                    Notifier.show(this, "Тіркелу сәтті өтті!", "Қош келдіңіз, " + u.firstName() + "! Пәтеріңіз дайын.",
                            AppNotification.SUCCESS);
                    startActivity(new Intent(this, MainActivity.class)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
                    finish();
                });
            } catch (AuthException ex) {
                main.post(() -> {
                    button.setEnabled(true);
                    progress.setVisibility(View.INVISIBLE);
                    switch (ex.field) {
                        case AuthException.NAME: nameL.setError(ex.getMessage()); break;
                        case AuthException.LOGIN: loginL.setError(ex.getMessage()); break;
                        case AuthException.EMAIL: emailL.setError(ex.getMessage()); break;
                        case AuthException.PASSWORD: passL.setError(ex.getMessage()); break;
                        case AuthException.CONFIRM: confirmL.setError(ex.getMessage()); break;
                        default:
                            error.setText(ex.getMessage());
                            error.setVisibility(View.VISIBLE);
                    }
                    UiUtil.shake(card);
                });
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        io.shutdown();
    }
}
