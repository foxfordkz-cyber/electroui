package com.example.electroui;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.example.electroui.data.Session;
import com.example.electroui.util.UiUtil;

/** One server session and apartment model across Android and the website. */
public class EnergyMapActivity extends BaseActivity {
    private static final String HOST = "electroui-studio.onrender.com";
    private static final String APARTMENT_URL = "https://" + HOST + "/#/three";
    private WebView web;
    private View error;
    private ProgressBar progress;
    private String pendingOrigin;
    private GeolocationPermissions.Callback pendingLocation;
    private ValueCallback<Uri[]> pendingFile;
    private boolean pickerOpen;
    private static final String[] FILE_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"};

    private final ActivityResultLauncher<String> permission = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(), this::answerLocation);
    private final ActivityResultLauncher<String[]> filePicker = registerForActivityResult(
            new ActivityResultContracts.OpenDocument(), uri -> {
                pickerOpen = false;
                boolean valid = uri != null && "content".equals(uri.getScheme()) && uri.getAuthority() != null
                        && !uri.getAuthority().startsWith(getPackageName()) && onTrustedPage();
                completeFile(valid ? uri : null);
            });

    private boolean onTrustedPage() {
        return web != null && web.getUrl() != null && trusted(Uri.parse(web.getUrl()));
    }

    private void completeFile(Uri uri) {
        ValueCallback<Uri[]> callback = pendingFile;
        pendingFile = null;
        if (callback != null) callback.onReceiveValue(uri == null ? null : new Uri[]{uri});
    }

    private static boolean trusted(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private void answerLocation(boolean granted) {
        if (pendingLocation == null) return;
        pendingLocation.invoke(pendingOrigin, granted && onTrustedPage(), false);
        pendingLocation = null;
        pendingOrigin = null;
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getSharedPreferences("navigation", MODE_PRIVATE).edit().putBoolean("online", true).apply();
        setContentView(R.layout.activity_energy_map);
        UiUtil.insets(findViewById(R.id.map_root), true, true);
        web = findViewById(R.id.map_web);
        error = findViewById(R.id.map_error);
        progress = findViewById(R.id.map_loading);
        findViewById(R.id.device_mode).setOnClickListener(v -> openDeviceMode());
        findViewById(R.id.map_retry).setOnClickListener(v -> web.loadUrl(APARTMENT_URL));

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (trusted(url)) return false;
                if (request.isForMainFrame() && request.hasGesture() && "https".equals(url.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                    catch (ActivityNotFoundException ignored) { /* No external browser installed. */ }
                }
                return true;
            }

            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                answerLocation(false);
                completeFile(null);
                error.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) error.setVisibility(View.VISIBLE);
            }

            @Override public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse res) {
                if (req.isForMainFrame() && res.getStatusCode() >= 400) error.setVisibility(View.VISIBLE);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!onTrustedPage() || pickerOpen || params.getMode() != FileChooserParams.MODE_OPEN) {
                    callback.onReceiveValue(null);
                    return true;
                }
                pendingFile = callback;
                pickerOpen = true;
                try { filePicker.launch(FILE_TYPES); }
                catch (ActivityNotFoundException e) { pickerOpen = false; completeFile(null); }
                return true;
            }

            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value);
                progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE);
            }

            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!trusted(Uri.parse(origin)) || web.getUrl() == null || !trusted(Uri.parse(web.getUrl()))) {
                    callback.invoke(origin, false, false);
                    return;
                }
                answerLocation(false);
                pendingOrigin = origin;
                pendingLocation = callback;
                if (ContextCompat.checkSelfPermission(EnergyMapActivity.this, Manifest.permission.ACCESS_COARSE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED) answerLocation(true);
                else permission.launch(Manifest.permission.ACCESS_COARSE_LOCATION);
            }

            @Override public void onGeolocationPermissionsHidePrompt() { answerLocation(false); }
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack();
                else finish();
            }
        });
        if (state == null || web.restoreState(state) == null) web.loadUrl(APARTMENT_URL);
    }

    private void openDeviceMode() {
        getSharedPreferences("navigation", MODE_PRIVATE).edit().putBoolean("online", false).apply();
        Class<?> screen = Session.user(this) == null ? LoginActivity.class : MainActivity.class;
        startActivity(new Intent(this, screen).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP));
        finish();
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        web.saveState(out);
        super.onSaveInstanceState(out);
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override protected void onPause() {
        if (web != null) web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override protected void onDestroy() {
        answerLocation(false);
        completeFile(null);
        if (web != null) {
            web.stopLoading();
            web.setWebChromeClient(null);
            web.setWebViewClient(null);
            ((ViewGroup) web.getParent()).removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
