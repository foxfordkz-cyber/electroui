package com.example.electroui;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.TextView;

import com.example.electroui.data.AuthException;
import com.example.electroui.data.Session;
import com.example.electroui.data.UserRepository;
import com.example.electroui.model.User;
import com.example.electroui.util.UiUtil;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Жүйеге кіру: логин + құпиясөз хэшін тексеру. */
public class LoginActivity extends BaseActivity {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private TextInputLayout loginLayout, passwordLayout;
    private TextInputEditText login, password;
    private TextView error;
    private MaterialButton button;
    private View progress, card;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Session.user(this) != null) {
            openMain();
            return;
        }
        setContentView(R.layout.activity_login);
        UiUtil.insets(findViewById(R.id.content), true, true);

        loginLayout = findViewById(R.id.login_layout);
        passwordLayout = findViewById(R.id.password_layout);
        login = findViewById(R.id.input_login);
        password = findViewById(R.id.input_password);
        error = findViewById(R.id.error);
        button = findViewById(R.id.btn_login);
        progress = findViewById(R.id.progress);
        card = findViewById(R.id.card);

        UiUtil.fadeUp(findViewById(R.id.brand), 0);
        UiUtil.fadeUp(findViewById(R.id.headline), 120);
        UiUtil.fadeUp(card, 220);
        findViewById(R.id.hero).animate().scaleX(1.08f).scaleY(1.08f).setDuration(9000).start();

        String prefill = getIntent().getStringExtra("login");
        if (prefill != null) login.setText(prefill);

        button.setOnClickListener(v -> attempt());
        password.setOnEditorActionListener((v, actionId, e) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                attempt();
                return true;
            }
            return false;
        });
        findViewById(R.id.demo_admin).setOnClickListener(v -> fill("admin", "Admin123!"));
        findViewById(R.id.demo_client).setOnClickListener(v -> fill("aru", "Aru12345!"));
        findViewById(R.id.btn_register).setOnClickListener(v -> {
            startActivity(new Intent(this, RegisterActivity.class));
            overridePendingTransition(R.anim.slide_in_right, R.anim.fade_out);
        });
    }

    private void fill(String l, String p) {
        login.setText(l);
        password.setText(p);
        UiUtil.pulse(button);
    }

    private void attempt() {
        loginLayout.setError(null);
        passwordLayout.setError(null);
        error.setVisibility(View.GONE);
        hideKeyboard();
        String l = text(login), p = text(password);
        setBusy(true);
        io.execute(() -> {
            try {
                User u = new UserRepository(this).login(l, p);
                main.post(() -> {
                    Session.start(this, u.id);
                    openMain();
                });
            } catch (AuthException e) {
                main.post(() -> {
                    setBusy(false);
                    if (e.field == AuthException.LOGIN) loginLayout.setError(e.getMessage());
                    else if (e.field == AuthException.PASSWORD) passwordLayout.setError(e.getMessage());
                    else {
                        error.setText(e.getMessage());
                        error.setVisibility(View.VISIBLE);
                    }
                    UiUtil.shake(card);
                });
            }
        });
    }

    private void setBusy(boolean busy) {
        button.setEnabled(!busy);
        button.setText(busy ? "Тексерілуде…" : "Кіру");
        progress.setVisibility(busy ? View.VISIBLE : View.INVISIBLE);
    }

    private void openMain() {
        startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        finish();
    }

    private void hideKeyboard() {
        InputMethodManager imm = getSystemService(InputMethodManager.class);
        if (imm != null && getCurrentFocus() != null) imm.hideSoftInputFromWindow(getCurrentFocus().getWindowToken(), 0);
    }

    static String text(TextInputEditText e) {
        return e.getText() == null ? "" : e.getText().toString();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        io.shutdown();
    }
}
