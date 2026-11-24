package com.throttlelog.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThrottleLogNativePlugin.class);
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent(), false);
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
            }
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
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().resumeTimers();
            }
        } catch (Exception ignored) {}
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
