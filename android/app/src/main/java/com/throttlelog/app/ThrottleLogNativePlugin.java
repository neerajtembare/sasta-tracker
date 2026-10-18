package com.throttlelog.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ThrottleLogNative")
public class ThrottleLogNativePlugin extends Plugin {

    @Override
    public void load() {
        super.load();
        ThrottleLogKeepAliveService.locationCallback = (location, totalDistanceMeters) -> {
            JSObject data = new JSObject();
            data.put("latitude", location.getLatitude());
            data.put("longitude", location.getLongitude());
            data.put("speed", location.hasSpeed() ? (double) location.getSpeed() : null);
            data.put("speedKmh", location.hasSpeed() ? (double) (location.getSpeed() * 3.6f) : 0.0);
            data.put("altitude", location.hasAltitude() ? location.getAltitude() : null);
            data.put("bearing", location.hasBearing() ? (double) location.getBearing() : null);
            data.put("accuracy", location.hasAccuracy() ? (double) location.getAccuracy() : 0.0);
            data.put("time", location.getTime());
            data.put("totalDistanceMeters", totalDistanceMeters);

            notifyListeners("onNativeLocation", data);
        };
    }

    @PluginMethod
    public void startKeepAlive(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), ThrottleLogKeepAliveService.class);
            ContextCompat.startForegroundService(getContext(), serviceIntent);
            call.resolve();
        } catch (Exception e) {
            android.util.Log.w("ThrottleLogNative", "Could not start foreground keep-alive service: " + e.getMessage());
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

    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            boolean isIgnored = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && pm != null) {
                isIgnored = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            }
            JSObject ret = new JSObject();
            ret.put("isIgnored", isIgnored);
            call.resolve(ret);
        } catch (Exception e) {
            call.resolve(new JSObject().put("isIgnored", true));
        }
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                String packageName = getContext().getPackageName();
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                }
            }
            call.resolve();
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception ex) {
                call.resolve();
            }
        }
    }
}
