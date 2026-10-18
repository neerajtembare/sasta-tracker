package com.throttlelog.app;

import android.content.Intent;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ThrottleLogNative")
public class ThrottleLogNativePlugin extends Plugin {

    @PluginMethod
    public void startKeepAlive(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), ThrottleLogKeepAliveService.class);
            ContextCompat.startForegroundService(getContext(), serviceIntent);
            call.resolve();
        } catch (Exception e) {
            android.util.Log.w("ThrottleLogNative", "Could not start foreground keep-alive service (likely background restriction): " + e.getMessage());
            call.resolve(); // Resolve gracefully to avoid breaking Web promise chain
        }
    }

    @PluginMethod
    public void stopKeepAlive(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), ThrottleLogKeepAliveService.class);
            getContext().stopService(serviceIntent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop keep-alive service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void setKeepScreenOn(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", true);
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                if (Boolean.TRUE.equals(enabled)) {
                    getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
            call.resolve();
        } else {
            call.reject("Activity is null");
        }
    }
}
