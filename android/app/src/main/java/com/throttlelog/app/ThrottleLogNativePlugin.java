package com.throttlelog.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.WindowManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.util.Locale;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ThrottleLogNative")
public class ThrottleLogNativePlugin extends Plugin {

    public static String lastSharedText = null;
    private static ThrottleLogNativePlugin activeInstance = null;
    private TextToSpeech tts;
    private boolean isTtsReady = false;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;

    public static void deliverSharedText(String text, boolean notifyListenersNow) {
        lastSharedText = text;
        if (notifyListenersNow && activeInstance != null && text != null && !text.isEmpty()) {
            try {
                JSObject data = new JSObject();
                data.put("text", text);
                activeInstance.notifyListeners("onSharedTextReceived", data);
            } catch (Exception ignored) {}
        }
    }

    private void requestTransientAudioFocus() {
        try {
            if (audioManager == null && getContext() != null) {
                audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            }
            if (audioManager == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();

                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(playbackAttributes)
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener(focusChange -> {})
                    .build();

                audioManager.requestAudioFocus(audioFocusRequest);
            } else {
                audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                );
            }
        } catch (Exception ignored) {}
    }

    private void abandonTransientAudioFocus() {
        try {
            if (audioManager == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
            } else {
                audioManager.abandonAudioFocus(null);
            }
        } catch (Exception ignored) {}
    }

    private void setupTtsListener() {
        if (tts == null) return;
        try {
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {}

                @Override
                public void onDone(String utteranceId) {
                    abandonTransientAudioFocus();
                }

                @Override
                public void onError(String utteranceId) {
                    abandonTransientAudioFocus();
                }
            });
        } catch (Exception ignored) {}
    }

    @Override
    public void load() {
        super.load();
        activeInstance = this;

        try {
            tts = new TextToSpeech(getContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    try {
                        int res = tts.setLanguage(Locale.US);
                        if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                            tts.setLanguage(Locale.getDefault());
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build();
                            tts.setAudioAttributes(audioAttributes);
                        }
                        setupTtsListener();
                        isTtsReady = true;
                    } catch (Exception ignored) {}
                }
            });
        } catch (Exception e) {
            android.util.Log.w("ThrottleLogNative", "TTS init exception: " + e.getMessage());
        }

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

        ThrottleLogKeepAliveService.crashCallback = (peakG, preSpeedKmh) -> {
            JSObject data = new JSObject();
            data.put("peakG", peakG);
            data.put("preImpactSpeedKmh", preSpeedKmh);
            data.put("timestamp", System.currentTimeMillis());

            notifyListeners("onNativeCrashDetected", data);
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

    @PluginMethod
    public void requestMicrophonePermission(PluginCall call) {
        try {
            boolean hasPermission = ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED;

            if (!hasPermission && getActivity() != null) {
                ActivityCompat.requestPermissions(
                    getActivity(),
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    1002
                );
            }
            JSObject ret = new JSObject();
            ret.put("granted", hasPermission);
            call.resolve(ret);
        } catch (Exception e) {
            call.resolve(new JSObject().put("granted", true));
        }
    }

    @PluginMethod
    public void checkLocationPermission(PluginCall call) {
        try {
            boolean hasFine = ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED;
            boolean hasCoarse = ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED;

            JSObject ret = new JSObject();
            ret.put("fine", hasFine);
            ret.put("coarse", hasCoarse);
            ret.put("granted", hasFine);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("fine", false);
            ret.put("coarse", false);
            ret.put("granted", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void requestLocationPermission(PluginCall call) {
        try {
            boolean hasFine = ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED;

            if (!hasFine && getActivity() != null) {
                ActivityCompat.requestPermissions(
                    getActivity(),
                    new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    1001
                );
            }
            JSObject ret = new JSObject();
            ret.put("granted", hasFine);
            call.resolve(ret);
        } catch (Exception e) {
            call.resolve(new JSObject().put("granted", false));
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception ex) {
                call.resolve();
            }
        }
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.resolve();
        }
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.resolve();
            return;
        }

        float rate = call.getFloat("rate", 1.05f);
        float pitch = call.getFloat("pitch", 1.0f);
        String queueMode = call.getString("queue", "flush");
        int queueConstant = "add".equalsIgnoreCase(queueMode) ? TextToSpeech.QUEUE_ADD : TextToSpeech.QUEUE_FLUSH;

        // Request audio focus ducking so helmet intercom music is lowered during alert
        requestTransientAudioFocus();

        if (tts == null) {
            tts = new TextToSpeech(getContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    try {
                        tts.setLanguage(Locale.US);
                        tts.setSpeechRate(rate);
                        tts.setPitch(pitch);
                        setupTtsListener();
                        isTtsReady = true;
                        String utteranceId = "tts_" + System.currentTimeMillis();
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            tts.speak(text, queueConstant, null, utteranceId);
                        } else {
                            tts.speak(text, queueConstant, null);
                        }
                    } catch (Exception e) {
                        abandonTransientAudioFocus();
                    }
                } else {
                    abandonTransientAudioFocus();
                }
            });
            call.resolve();
            return;
        }

        try {
            tts.setSpeechRate(rate);
            tts.setPitch(pitch);
            String utteranceId = "tts_" + System.currentTimeMillis();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                tts.speak(text, queueConstant, null, utteranceId);
            } else {
                tts.speak(text, queueConstant, null);
            }
            call.resolve();
        } catch (Exception e) {
            android.util.Log.w("ThrottleLogNative", "TTS speak failed: " + e.getMessage());
            abandonTransientAudioFocus();
            call.resolve();
        }
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        try {
            if (tts != null) {
                tts.stop();
            }
            abandonTransientAudioFocus();
            call.resolve();
        } catch (Exception e) {
            abandonTransientAudioFocus();
            call.resolve();
        }
    }

    @PluginMethod
    public void requestAudioFocus(PluginCall call) {
        try {
            requestTransientAudioFocus();
            call.resolve();
        } catch (Exception e) {
            call.resolve();
        }
    }

    @PluginMethod
    public void abandonAudioFocus(PluginCall call) {
        try {
            abandonTransientAudioFocus();
            call.resolve();
        } catch (Exception e) {
            call.resolve();
        }
    }

    @PluginMethod
    public void getLastSharedText(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("text", lastSharedText);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearLastSharedText(PluginCall call) {
        lastSharedText = null;
        call.resolve();
    }

    @PluginMethod
    public void unshortenUrl(PluginCall call) {
        String shortUrl = call.getString("url");
        if (shortUrl == null || shortUrl.isEmpty()) {
            call.reject("URL is empty");
            return;
        }

        new Thread(() -> {
            String current = shortUrl;
            try {
                int redirects = 0;
                while (redirects < 8) {
                    java.net.URL u = new java.net.URL(current);
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) u.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
                    conn.setConnectTimeout(6000);
                    conn.setReadTimeout(6000);
                    conn.connect();

                    int code = conn.getResponseCode();
                    if (code == java.net.HttpURLConnection.HTTP_MOVED_PERM ||
                        code == java.net.HttpURLConnection.HTTP_MOVED_TEMP ||
                        code == 303 || code == 307 || code == 308) {
                        String loc = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (loc != null && !loc.isEmpty()) {
                            current = new java.net.URL(u, loc).toString();
                            redirects++;
                        } else {
                            break;
                        }
                    } else {
                        // If final resolved URL has no coordinates (e.g. HTML preview /consent / meta redirect),
                        // inspect up to 64KB of HTML for embedded Google Maps URLs or @lat,lon / staticmap coords
                        if (!current.contains("@") && !current.contains("!3d") && code >= 200 && code < 400) {
                            try (java.io.InputStream is = conn.getInputStream()) {
                                byte[] buf = new byte[65536];
                                int total = 0;
                                int n;
                                while (total < buf.length && (n = is.read(buf, total, buf.length - total)) != -1) {
                                    total += n;
                                }
                                String body = new String(buf, 0, total, java.nio.charset.StandardCharsets.UTF_8);
                                java.util.regex.Matcher m = java.util.regex.Pattern
                                    .compile("(https://(?:www\\.)?google\\.com/maps[^\"'<>\\s\\\\]+|!3d-?\\d{1,2}\\.\\d{2,12}!4d-?\\d{1,3}\\.\\d{2,12}|@-?\\d{1,2}\\.\\d{2,12},-?\\d{1,3}\\.\\d{2,12}|staticmap\\?center=(-?\\d{1,2}\\.\\d{2,12})(?:,|%2C)(-?\\d{1,3}\\.\\d{2,12}))")
                                    .matcher(body);
                                if (m.find()) {
                                    String found = m.group(1);
                                    if (found != null && found.startsWith("http")) {
                                        current = found;
                                    } else if (m.group(2) != null && m.group(3) != null) {
                                        current = current + (current.contains("?") ? "&" : "?") + "q=" + m.group(2) + "," + m.group(3);
                                    } else if (found != null) {
                                        current = current + "#" + found;
                                    }
                                }
                            } catch (Exception ignored) {}
                        }
                        conn.disconnect();
                        break;
                    }
                }

                JSObject ret = new JSObject();
                ret.put("resolvedUrl", current);
                call.resolve(ret);
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("resolvedUrl", current);
                call.resolve(ret);
            }
        }).start();
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (activeInstance == this) {
            activeInstance = null;
        }
        abandonTransientAudioFocus();
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {}
            tts = null;
        }
    }
}
