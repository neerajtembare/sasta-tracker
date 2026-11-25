package com.throttlelog.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private int lastInsetTopDp = 0;
    private int lastInsetBottomDp = 0;
    private int lastInsetLeftDp = 0;
    private int lastInsetRightDp = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThrottleLogNativePlugin.class);
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent(), false);
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
                webView.postDelayed(this::injectNativeSafeAreaInsets, 300);
                webView.postDelayed(this::injectNativeSafeAreaInsets, 1200);
            }
        } catch (Exception ignored) {}

        try {
            View rootView = findViewById(android.R.id.content);
            if (rootView == null) rootView = getWindow().getDecorView();
            ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, windowInsets) -> {
                Insets barsAndCutout = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                float density = view.getResources().getDisplayMetrics().density;
                if (density <= 0f) density = 1f;
                lastInsetTopDp = Math.max(0, Math.round(barsAndCutout.top / density));
                lastInsetBottomDp = Math.max(0, Math.round(barsAndCutout.bottom / density));
                lastInsetLeftDp = Math.max(0, Math.round(barsAndCutout.left / density));
                lastInsetRightDp = Math.max(0, Math.round(barsAndCutout.right / density));
                injectNativeSafeAreaInsets();
                return ViewCompat.onApplyWindowInsets(view, windowInsets);
            });
            ViewCompat.requestApplyInsets(rootView);
        } catch (Exception ignored) {}
    }

    private void injectNativeSafeAreaInsets() {
        try {
            if (getBridge() == null) return;
            final WebView webView = getBridge().getWebView();
            if (webView == null) return;
            final String js = "(function(){var s=document.documentElement&&document.documentElement.style;if(!s)return;"
                + "s.setProperty('--native-safe-top','" + lastInsetTopDp + "px');"
                + "s.setProperty('--native-safe-bottom','" + lastInsetBottomDp + "px');"
                + "s.setProperty('--native-safe-left','" + lastInsetLeftDp + "px');"
                + "s.setProperty('--native-safe-right','" + lastInsetRightDp + "px');"
                + "})();";
            webView.post(() -> webView.evaluateJavascript(js, null));
        } catch (Exception ignored) {}
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent, true);
    }

    private void handleIncomingIntent(Intent intent, boolean notifyActive) {
        if (intent == null) return;
        if (intent.getBooleanExtra("throttlelog_consumed", false)) {
            return;
        }
        String action = intent.getAction();
        String type = intent.getType();
        String extracted = null;

        if (Intent.ACTION_SEND.equals(action) && type != null) {
            if ("text/plain".equals(type)) {
                String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (sharedText != null && !sharedText.trim().isEmpty()) {
                    extracted = sharedText.trim();
                }
            }
        } else if (Intent.ACTION_VIEW.equals(action)) {
            Uri data = intent.getData();
            if (data != null) {
                extracted = data.toString();
            }
        }

        if (extracted != null && !extracted.isEmpty()) {
            intent.putExtra("throttlelog_consumed", true);
            ThrottleLogNativePlugin.deliverSharedText(extracted, notifyActive);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        handleIncomingIntent(getIntent(), true);
        try {
            View rootView = findViewById(android.R.id.content);
            if (rootView == null) rootView = getWindow().getDecorView();
            ViewCompat.requestApplyInsets(rootView);
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.resumeTimers();
                injectNativeSafeAreaInsets();
                webView.postDelayed(this::injectNativeSafeAreaInsets, 250);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            try {
                View rootView = findViewById(android.R.id.content);
                if (rootView == null) rootView = getWindow().getDecorView();
                ViewCompat.requestApplyInsets(rootView);
                injectNativeSafeAreaInsets();
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().goBack();
        } else {
            // Keep app and ride tracking alive in background instead of destroying Activity
            moveTaskToBack(true);
        }
    }
}
