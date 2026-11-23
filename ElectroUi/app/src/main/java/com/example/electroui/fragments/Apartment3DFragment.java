package com.example.electroui.fragments;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.example.electroui.R;
import com.example.electroui.data.ApplianceRepository;
import com.example.electroui.data.SettingsRepository;
import com.example.electroui.model.Apartment;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.model.PlugResult;
import com.example.electroui.model.Room;
import com.example.electroui.util.Alerts;
import com.example.electroui.util.ThemeManager;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * 3D пәтер: WebView ішінде three.js (assets/3d/index.html).
 * JavaScript ↔ Java көпірі: window.Android.data(), toggle(id), details(id).
 */
public class Apartment3DFragment extends BaseFragment {
    private WebView web;
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean ready;

    @SuppressLint("SetJavaScriptEnabled")
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_3d, container, false);
        View loading = v.findViewById(R.id.loading);
        web = v.findViewById(R.id.web);
        web.setBackgroundColor(0);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new Bridge(requireContext().getApplicationContext()), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                ready = true;
                loading.animate().alpha(0f).setDuration(300).withEndAction(() -> loading.setVisibility(View.GONE)).start();
            }
        });
        web.loadUrl("file:///android_asset/3d/index.html");
        return v;
    }

    @Override
    protected void onDataChanged() {
        if (ready && web != null) web.evaluateJavascript("window.refresh && window.refresh()", null);
    }

    @Override
    public void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    public void onDestroyView() {
        if (web != null) {
            web.removeJavascriptInterface("Android");
            web.destroy();
            web = null;
        }
        super.onDestroyView();
    }

    /** JavaScript-тен шақырылатын әдістер (WebView-дің фондық ағынында орындалады). */
    private class Bridge {
        private final Context app;
        private final long userId;
        private final boolean dark;
        private final String accent;

        Bridge(Context app) {
            this.app = app;
            this.userId = uid();
            this.dark = ThemeManager.isDark(requireContext());
            this.accent = ThemeManager.accentHex(app);
        }

        @JavascriptInterface
        public String data() {
            try {
                return json().toString();
            } catch (JSONException e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public String toggle(String id) {
            JSONObject out = new JSONObject();
            try {
                long applianceId = Long.parseLong(id);
                ElectricAppliance a = new ApplianceRepository(app).get(applianceId);
                if (a == null) {
                    out.put("ok", false).put("message", "Құрал табылмады");
                } else {
                    PlugResult r = Alerts.plug(app, userId, applianceId, !a.isPluggedIn());
                    out.put("ok", r.ok)
                            .put("overload", r.apartmentOverload || r.roomOverload)
                            .put("message", r.ok && (r.apartmentOverload || r.roomOverload)
                                    ? "⚠ Шамадан тыс жүктеме! " + r.message : r.message);
                }
                out.put("data", json());
            } catch (Exception e) {
                try {
                    out.put("ok", false).put("message", "Қате: " + e.getMessage());
                } catch (JSONException ignored) {
                }
            }
            return out.toString();
        }

        @JavascriptInterface
        public void details(String id) {
            main.post(() -> {
                if (!isAdded()) return;
                ElectricAppliance a = repo().get(Long.parseLong(id));
                if (a != null) showDetails(a);
            });
        }

        private JSONObject json() throws JSONException {
            Apartment ap = new ApplianceRepository(app).load(userId);
            SettingsRepository s = new SettingsRepository(app);
            JSONObject o = new JSONObject();
            o.put("dark", dark).put("accent", accent).put("limit", s.limit()).put("roomLimit", s.roomLimit())
                    .put("tariff", s.tariff());
            JSONArray rooms = new JSONArray();
            for (Room r : ap.getRooms())
                rooms.put(new JSONObject().put("id", r.getId()).put("name", r.getName()).put("sockets", r.getSockets()));
            JSONArray items = new JSONArray();
            for (ElectricAppliance a : ap.getAppliances())
                items.put(new JSONObject().put("id", a.getId()).put("type", a.type().name()).put("name", a.getName())
                        .put("typeName", a.typeName()).put("power", a.getPower()).put("plugged", a.isPluggedIn())
                        .put("roomId", a.getRoomId()).put("hours", a.getHoursPerDay())
                        .put("energyClass", a.getEnergyClass()).put("cls", a.getClass().getSimpleName()));
            o.put("rooms", rooms).put("items", items);
            return o;
        }
    }
}
