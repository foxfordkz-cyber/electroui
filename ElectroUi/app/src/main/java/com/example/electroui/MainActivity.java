package com.example.electroui;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.ActionBarDrawerToggle;
import androidx.core.view.GravityCompat;
import androidx.drawerlayout.widget.DrawerLayout;
import androidx.fragment.app.Fragment;

import com.example.electroui.data.ApplianceRepository;
import com.example.electroui.data.NotificationRepository;
import com.example.electroui.data.Session;
import com.example.electroui.fragments.AdminCatalogFragment;
import com.example.electroui.fragments.AdminStatsFragment;
import com.example.electroui.fragments.AdminUsersFragment;
import com.example.electroui.fragments.Apartment3DFragment;
import com.example.electroui.fragments.ApartmentFragment;
import com.example.electroui.fragments.CalculationFragment;
import com.example.electroui.fragments.HierarchyFragment;
import com.example.electroui.fragments.HomeFragment;
import com.example.electroui.fragments.MediaFragment;
import com.example.electroui.fragments.NotificationsFragment;
import com.example.electroui.fragments.ProfileFragment;
import com.example.electroui.fragments.SearchFragment;
import com.example.electroui.fragments.SettingsFragment;
import com.example.electroui.fragments.SortFragment;
import com.example.electroui.model.Apartment;
import com.example.electroui.model.AppNotification;
import com.example.electroui.model.User;
import com.example.electroui.util.Alerts;
import com.example.electroui.util.DataBus;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.Notifier;
import com.example.electroui.util.ThemeManager;
import com.example.electroui.util.UiUtil;
import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.navigation.NavigationView;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

/** Басты Activity: бүйірлік мәзір (sidebar), тақырыпша, фрагменттер ауысатын контейнер. */
public class MainActivity extends BaseActivity {
    private static final String STATE_SCREEN = "screen";

    private DrawerLayout drawer;
    private NavigationView nav;
    private MaterialToolbar toolbar;
    private TextView badge;
    private User user;
    private int current;
    private final Runnable onData = this::refreshChrome;

    private final ActivityResultLauncher<String> notificationPermission =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (!granted) snack("Хабарламалар өшірулі — ескертулер тек қосымша ішінде көрінеді");
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        user = Session.user(this);
        if (user == null) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }
        setContentView(R.layout.activity_main);
        drawer = findViewById(R.id.drawer);
        nav = findViewById(R.id.nav);
        toolbar = findViewById(R.id.toolbar);
        UiUtil.insets(findViewById(R.id.appbar), true, false);
        UiUtil.insets(findViewById(R.id.container), false, true);

        setSupportActionBar(toolbar);
        ActionBarDrawerToggle toggle = new ActionBarDrawerToggle(this, drawer, toolbar, R.string.drawer_open, R.string.drawer_close);
        toggle.getDrawerArrowDrawable().setColor(0xFFFFFFFF);
        drawer.addDrawerListener(toggle);
        toggle.syncState();

        nav.getMenu().findItem(R.id.section_admin).setVisible(user.isAdmin());
        nav.setNavigationItemSelectedListener(item -> {
            drawer.closeDrawer(GravityCompat.START);
            int id = item.getItemId();
            drawer.postDelayed(() -> open(id), 220);
            return true;
        });
        View header = nav.getHeaderView(0);
        header.findViewById(R.id.header_theme).setOnClickListener(v -> toggleTheme());

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (drawer.isDrawerOpen(GravityCompat.START)) drawer.closeDrawer(GravityCompat.START);
                else if (current != R.id.nav_home) open(R.id.nav_home);
                else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        if (Build.VERSION.SDK_INT >= 33 && !Notifier.permissionGranted(this))
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS);

        if (savedInstanceState != null) {
            current = savedInstanceState.getInt(STATE_SCREEN, R.id.nav_home);
            markChecked(current);
            setTitles(current);
        } else {
            open(screenFor(getIntent().getStringExtra(Notifier.EXTRA_OPEN)));
            greet();
        }
        refreshChrome();
    }

    private void greet() {
        if (!Session.takeGreeting(this)) return;
        int unread = new NotificationRepository(this).unread(user.id);
        snack("Сәлем, " + user.firstName() + "! Сіз «" + user.roleTitle() + "» ретінде кірдіңіз");
        if (unread > 0)
            Notifier.show(this, "Оқылмаған хабарламалар: " + unread,
                    "Сізге " + unread + " жаңа хабарлама келді. Ашу үшін басыңыз.", AppNotification.INFO);
    }

    @Override
    protected void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        String key = intent.getStringExtra(Notifier.EXTRA_OPEN);
        if (key != null) open(screenFor(key));
    }

    /** Хабарламадан немесе сілтемеден келгенде қай бөлімді ашу керек: "notifications", "3d", "search"… */
    private static int screenFor(String key) {
        if (key == null) return R.id.nav_home;
        switch (key) {
            case "hierarchy": return R.id.nav_hierarchy;
            case "apartment": return R.id.nav_apartment;
            case "calc": return R.id.nav_calc;
            case "sort": return R.id.nav_sort;
            case "search": return R.id.nav_search;
            case "3d": return R.id.nav_3d;
            case "media": return R.id.nav_media;
            case "notifications": return R.id.nav_notifications;
            case "profile": return R.id.nav_profile;
            case "settings": return R.id.nav_settings;
            case "users": return R.id.nav_admin_users;
            case "catalog": return R.id.nav_admin_catalog;
            case "stats": return R.id.nav_admin_stats;
            default: return R.id.nav_home;
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        DataBus.register(onData);
        if (user != null) refreshChrome();
    }

    @Override
    protected void onStop() {
        super.onStop();
        DataBus.unregister(onData);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putInt(STATE_SCREEN, current);
    }

    // ------------------------------------------------------------------ навигация
    public void open(int id) {
        if (id == R.id.nav_logout) {
            confirmLogout();
            return;
        }
        if (id == R.id.nav_admin_broadcast) {
            broadcastDialog();
            return;
        }
        boolean adminOnly = id == R.id.nav_admin_users || id == R.id.nav_admin_catalog || id == R.id.nav_admin_stats;
        if (adminOnly && !user.isAdmin()) {
            snack("Бұл бөлім тек әкімшіге арналған");
            return;
        }
        Fragment f = create(id);
        if (f == null) return;
        current = id;
        getSupportFragmentManager().beginTransaction()
                .setCustomAnimations(R.anim.slide_in_right, R.anim.fade_out)
                .replace(R.id.container, f)
                .commit();
        markChecked(id);
        setTitles(id);
    }

    private Fragment create(int id) {
        if (id == R.id.nav_home) return new HomeFragment();
        if (id == R.id.nav_hierarchy) return new HierarchyFragment();
        if (id == R.id.nav_apartment) return new ApartmentFragment();
        if (id == R.id.nav_calc) return new CalculationFragment();
        if (id == R.id.nav_sort) return new SortFragment();
        if (id == R.id.nav_search) return new SearchFragment();
        if (id == R.id.nav_3d) return new Apartment3DFragment();
        if (id == R.id.nav_media) return new MediaFragment();
        if (id == R.id.nav_notifications) return new NotificationsFragment();
        if (id == R.id.nav_profile) return new ProfileFragment();
        if (id == R.id.nav_settings) return new SettingsFragment();
        if (id == R.id.nav_admin_users) return new AdminUsersFragment();
        if (id == R.id.nav_admin_catalog) return new AdminCatalogFragment();
        if (id == R.id.nav_admin_stats) return new AdminStatsFragment();
        return null;
    }

    private void setTitles(int id) {
        MenuItem item = nav.getMenu().findItem(id);
        String title = item == null ? getString(R.string.app_name) : item.getTitle().toString().replaceFirst("^\\d\\. ", "");
        setTitle(id == R.id.nav_home ? getString(R.string.app_name) : title);
        if (getSupportActionBar() != null)
            getSupportActionBar().setSubtitle(id == R.id.nav_home ? user.fullName + " · " + user.roleTitle() : null);
    }

    private void markChecked(int id) {
        Menu menu = nav.getMenu();
        for (int i = 0; i < menu.size(); i++) {
            MenuItem section = menu.getItem(i);
            if (section.hasSubMenu()) {
                Menu sub = section.getSubMenu();
                for (int j = 0; j < sub.size(); j++) sub.getItem(j).setChecked(sub.getItem(j).getItemId() == id);
            }
        }
    }

    // ------------------------------------------------------------------ тақырыпша және бадж
    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.toolbar, menu);
        View bell = menu.findItem(R.id.action_notifications).getActionView();
        if (bell != null) {
            badge = bell.findViewById(R.id.bell_badge);
            bell.setOnClickListener(v -> open(R.id.nav_notifications));
        }
        refreshChrome();
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == R.id.action_theme) {
            toggleTheme();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void toggleTheme() {
        ThemeManager.setMode(this, ThemeManager.isDark(this) ? ThemeManager.MODE_LIGHT : ThemeManager.MODE_DARK);
    }

    /** Бадж, бүйірлік мәзірдің тақырыпшасы — деректер өзгерген сайын жаңарады. */
    public void refreshChrome() {
        if (user == null || nav == null) return;
        User fresh = Session.user(this);
        if (fresh == null) {
            logout();
            return;
        }
        user = fresh;
        int unread = new NotificationRepository(this).unread(user.id);
        if (badge != null) {
            badge.setVisibility(unread > 0 ? View.VISIBLE : View.GONE);
            badge.setText(unread > 99 ? "99+" : String.valueOf(unread));
        }
        MenuItem n = nav.getMenu().findItem(R.id.nav_notifications);
        if (n != null) n.setTitle(unread > 0 ? "Хабарламалар (" + unread + ")" : "Хабарламалар");

        View h = nav.getHeaderView(0);
        ((TextView) h.findViewById(R.id.header_avatar)).setText(user.initials());
        ((TextView) h.findViewById(R.id.header_name)).setText(user.fullName);
        ((TextView) h.findViewById(R.id.header_role)).setText(user.roleTitle());
        ((TextView) h.findViewById(R.id.header_login)).setText("@" + user.login);
        Apartment a = new ApplianceRepository(this).load(user.id);
        ((TextView) h.findViewById(R.id.header_power)).setText("Розеткада " + a.plugged().size() + " құрал · "
                + Fmt.watts(a.pluggedPower()));
    }

    // ------------------------------------------------------------------ әрекеттер
    private void broadcastDialog() {
        if (!user.isAdmin()) return;
        View v = getLayoutInflater().inflate(R.layout.dialog_broadcast, null);
        TextInputLayout titleL = v.findViewById(R.id.title_layout), bodyL = v.findViewById(R.id.body_layout);
        TextInputEditText title = v.findViewById(R.id.input_title), body = v.findViewById(R.id.input_body);
        androidx.appcompat.app.AlertDialog d = new MaterialAlertDialogBuilder(this)
                .setTitle("Барлық клиентке хабарлама")
                .setIcon(R.drawable.ic_campaign)
                .setView(v)
                .setNegativeButton("Болдырмау", null)
                .setPositiveButton("Жіберу", null)
                .show();
        d.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener(b -> {
            String t = LoginActivity.text(title).trim(), m = LoginActivity.text(body).trim();
            titleL.setError(t.isEmpty() ? "Тақырыбын жазыңыз" : null);
            bodyL.setError(m.isEmpty() ? "Мәтінін жазыңыз" : null);
            if (t.isEmpty() || m.isEmpty()) return;
            int n = new NotificationRepository(this).broadcastToClients(t, m);
            Alerts.push(this, user.id, "Хабарлама жіберілді", "«" + t + "» — " + n + " клиентке жеткізілді.",
                    AppNotification.SUCCESS, true);
            d.dismiss();
            snack("Хабарлама " + n + " клиентке жіберілді");
        });
    }

    private void confirmLogout() {
        new MaterialAlertDialogBuilder(this)
                .setTitle("Жүйеден шығу")
                .setIcon(R.drawable.ic_logout)
                .setMessage("Аккаунттан шығуды растайсыз ба?")
                .setNegativeButton("Жоқ", null)
                .setPositiveButton("Шығу", (d, w) -> logout())
                .show();
    }

    public void logout() {
        Session.end(this);
        startActivity(new Intent(this, LoginActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
        finish();
    }

    public User user() {
        return user;
    }

    public void snack(String message) {
        View root = findViewById(R.id.container);
        if (root != null) Snackbar.make(root, message, Snackbar.LENGTH_LONG).show();
    }
}
