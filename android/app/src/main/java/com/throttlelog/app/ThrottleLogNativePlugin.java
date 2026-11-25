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
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedList;
import java.util.Locale;
import java.util.Queue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(
    name = "ThrottleLogNative",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            },
            alias = "location"
        ),
        @Permission(
            strings = { Manifest.permission.RECORD_AUDIO },
            alias = "microphone"
        )
    }
)
public class ThrottleLogNativePlugin extends Plugin {

    public static String lastSharedText = null;
    private static ThrottleLogNativePlugin activeInstance = null;

    private static class PendingUtterance {
        final String text;
        final float rate;
        final float pitch;
        final int queueMode;
        final String utteranceId;

        PendingUtterance(String text, float rate, float pitch, int queueMode, String utteranceId) {
            this.text = text;
            this.rate = rate;
            this.pitch = pitch;
            this.queueMode = queueMode;
            this.utteranceId = utteranceId;
        }
    }

    private TextToSpeech tts;
    private volatile boolean isTtsReady = false;
    private volatile boolean isTtsInitializing = false;
    private final Queue<PendingUtterance> pendingUtterances = new LinkedList<>();
    private final Object ttsLock = new Object();

    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private final ExecutorService unshortenExecutor = Executors.newFixedThreadPool(2);

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

    private void emitTtsDone(String utteranceId, String status) {
        try {
            JSObject data = new JSObject();
            data.put("utteranceId", utteranceId != null ? utteranceId : "");
            data.put("status", status);
            notifyListeners("onTtsDone", data);
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
                    emitTtsDone(utteranceId, "done");
                }

                @Override
                public void onError(String utteranceId) {
                    abandonTransientAudioFocus();
                    emitTtsDone(utteranceId, "error");
                }
            });
        } catch (Exception ignored) {}
    }

    private void initTtsIfNeeded() {
        synchronized (ttsLock) {
            if (isTtsReady || isTtsInitializing || getContext() == null) return;
            isTtsInitializing = true;
            try {
                tts = new TextToSpeech(getContext(), status -> {
                    synchronized (ttsLock) {
                        isTtsInitializing = false;
                        if (status == TextToSpeech.SUCCESS && tts != null) {
                            try {
                                int res = tts.setLanguage(Locale.US);
                                if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                                    tts.setLanguage(Locale.getDefault());
                                }
                                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                    .build();
                                tts.setAudioAttributes(audioAttributes);
                                setupTtsListener();
                                isTtsReady = true;

                                while (!pendingUtterances.isEmpty()) {
                                    PendingUtterance next = pendingUtterances.poll();
                                    if (next != null) {
                                        dispatchSpeak(next);
                                    }
                                }
                            } catch (Exception e) {
                                isTtsReady = false;
                                drainPendingAsError();
                            }
                        } else {
                            isTtsReady = false;
                            drainPendingAsError();
                        }
                    }
                });
            } catch (Exception e) {
                isTtsInitializing = false;
                isTtsReady = false;
                android.util.Log.w("ThrottleLogNative", "TTS init exception: " + e.getMessage());
                drainPendingAsError();
            }
        }
    }

    private void drainPendingAsError() {
        while (!pendingUtterances.isEmpty()) {
            PendingUtterance next = pendingUtterances.poll();
            if (next != null) {
                emitTtsDone(next.utteranceId, "error");
            }
        }
        abandonTransientAudioFocus();
    }

    private void dispatchSpeak(PendingUtterance u) {
        if (tts == null || !isTtsReady) {
            emitTtsDone(u.utteranceId, "error");
            abandonTransientAudioFocus();
            return;
        }
        try {
            requestTransientAudioFocus();
            tts.setSpeechRate(u.rate);
            tts.setPitch(u.pitch);
            int speakResult = tts.speak(u.text, u.queueMode, null, u.utteranceId);
            if (speakResult == TextToSpeech.ERROR) {
                abandonTransientAudioFocus();
                emitTtsDone(u.utteranceId, "error");
            }
        } catch (Exception e) {
            android.util.Log.w("ThrottleLogNative", "TTS speak failed: " + e.getMessage());
            abandonTransientAudioFocus();
            emitTtsDone(u.utteranceId, "error");
        }
    }

    @Override
    public void load() {
        super.load();
        activeInstance = this;
        initTtsIfNeeded();

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
            boolean resetOdometer = Boolean.TRUE.equals(call.getBoolean("resetOdometer", false));
            boolean crashEnabled = Boolean.TRUE.equals(call.getBoolean("crashDetectionEnabled", true));
            ThrottleLogKeepAliveService.setCrashDetectionEnabled(crashEnabled);

            Intent serviceIntent = new Intent(getContext(), ThrottleLogKeepAliveService.class);
            serviceIntent.putExtra(ThrottleLogKeepAliveService.EXTRA_RESET_ODOMETER, resetOdometer);
            serviceIntent.putExtra(ThrottleLogKeepAliveService.EXTRA_CRASH_ENABLED, crashEnabled);
            ContextCompat.startForegroundService(getContext(), serviceIntent);
            call.resolve();
        } catch (Exception e) {
            android.util.Log.w("ThrottleLogNative", "Could not start foreground keep-alive service: " + e.getMessage());
            call.resolve();
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
    public void setCrashDetectionEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        ThrottleLogKeepAliveService.setCrashDetectionEnabled(enabled);
        call.resolve();
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

            if (hasPermission) {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                call.resolve(ret);
                return;
            }
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
        } catch (Exception e) {
            call.resolve(new JSObject().put("granted", false));
        }
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        boolean hasPermission = getPermissionState("microphone") == PermissionState.GRANTED ||
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", hasPermission);
        call.resolve(ret);
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

            if (hasFine) {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                ret.put("fine", true);
                ret.put("coarse", true);
                call.resolve(ret);
                return;
            }
            requestPermissionForAlias("location", call, "locationPermissionCallback");
        } catch (Exception e) {
            call.resolve(new JSObject().put("granted", false));
        }
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
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
        ret.put("granted", hasFine || hasCoarse);
        call.resolve(ret);
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
            call.resolve(new JSObject().put("utteranceId", ""));
            return;
        }

        float rate = call.getFloat("rate", 1.05f);
        float pitch = call.getFloat("pitch", 1.0f);
        String queueMode = call.getString("queue", "flush");
        int queueConstant = "add".equalsIgnoreCase(queueMode) ? TextToSpeech.QUEUE_ADD : TextToSpeech.QUEUE_FLUSH;
        String utteranceId = "tts_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 1000);
        PendingUtterance utterance = new PendingUtterance(text.trim(), rate, pitch, queueConstant, utteranceId);

        synchronized (ttsLock) {
            if (isTtsReady && tts != null) {
                dispatchSpeak(utterance);
            } else {
                if (queueConstant == TextToSpeech.QUEUE_FLUSH) {
                    drainPendingAsError();
                } else if (pendingUtterances.size() >= 12) {
                    PendingUtterance dropped = pendingUtterances.poll();
                    if (dropped != null) emitTtsDone(dropped.utteranceId, "error");
                }
                pendingUtterances.offer(utterance);
                initTtsIfNeeded();
            }
        }

        JSObject ret = new JSObject();
        ret.put("utteranceId", utteranceId);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        try {
            synchronized (ttsLock) {
                drainPendingAsError();
                if (tts != null) {
                    tts.stop();
                }
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

    private static boolean isAllowedGoogleMapsHost(String host) {
        if (host == null || host.isEmpty()) return false;
        String h = host.toLowerCase(Locale.US);
        if (h.equals("goo.gl") || h.equals("maps.app.goo.gl") || h.equals("app.goo.gl") || h.equals("g.co") || h.equals("share.google")) {
            return true;
        }
        return h.matches("^(?:www\\.|maps\\.|consent\\.)?google\\.(?:[a-z]{2,3}|co\\.[a-z]{2}|com\\.[a-z]{2})$");
    }

    @PluginMethod
    public void unshortenUrl(PluginCall call) {
        String shortUrl = call.getString("url");
        if (shortUrl == null || shortUrl.isEmpty()) {
            call.reject("URL is empty");
            return;
        }

        unshortenExecutor.execute(() -> {
            String current = shortUrl.trim();
            if (current.startsWith("http://")) {
                current = "https://" + current.substring(7);
            }
            try {
                URL initialParsed = new URL(current);
                if (!"https".equalsIgnoreCase(initialParsed.getProtocol()) || !isAllowedGoogleMapsHost(initialParsed.getHost())) {
                    JSObject ret = new JSObject();
                    ret.put("resolvedUrl", current);
                    call.resolve(ret);
                    return;
                }

                int redirects = 0;
                while (redirects < 8) {
                    URL u = new URL(current);
                    if (!"https".equalsIgnoreCase(u.getProtocol()) || !isAllowedGoogleMapsHost(u.getHost())) {
                        break;
                    }
                    HttpURLConnection conn = null;
                    try {
                        conn = (HttpURLConnection) u.openConnection();
                        conn.setInstanceFollowRedirects(false);
                        conn.setRequestMethod("GET");
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
                        conn.setConnectTimeout(6000);
                        conn.setReadTimeout(6000);
                        conn.connect();

                        int code = conn.getResponseCode();
                        if (code == HttpURLConnection.HTTP_MOVED_PERM ||
                            code == HttpURLConnection.HTTP_MOVED_TEMP ||
                            code == 303 || code == 307 || code == 308) {
                            String loc = conn.getHeaderField("Location");
                            if (loc != null && !loc.isEmpty()) {
                                String nextUrl = new URL(u, loc).toString();
                                if (nextUrl.startsWith("http://")) {
                                    nextUrl = "https://" + nextUrl.substring(7);
                                }
                                try {
                                    URL nextParsed = new URL(nextUrl);
                                    if (nextParsed.getHost() != null && nextParsed.getHost().contains("consent.google") && nextParsed.getQuery() != null) {
                                        for (String param : nextParsed.getQuery().split("&")) {
                                            if (param.startsWith("continue=")) {
                                                String decodedContinue = URLDecoder.decode(param.substring(9), "UTF-8");
                                                if (decodedContinue.startsWith("http://")) {
                                                    decodedContinue = "https://" + decodedContinue.substring(7);
                                                }
                                                URL decUrl = new URL(decodedContinue);
                                                if ("https".equalsIgnoreCase(decUrl.getProtocol()) && isAllowedGoogleMapsHost(decUrl.getHost())) {
                                                    nextUrl = decodedContinue;
                                                }
                                                break;
                                            }
                                        }
                                    }
                                    URL checkNext = new URL(nextUrl);
                                    if (!"https".equalsIgnoreCase(checkNext.getProtocol()) || !isAllowedGoogleMapsHost(checkNext.getHost())) {
                                        break;
                                    }
                                } catch (Exception ignored) {
                                    break;
                                }
                                current = nextUrl;
                                redirects++;
                            } else {
                                break;
                            }
                        } else {
                            boolean hasCoords = current.contains("@") || current.contains("!3d") || current.contains("!1d") || current.contains("destination=") || current.contains("q=");
                            if (!hasCoords && code >= 200 && code < 400) {
                                try (java.io.InputStream is = conn.getInputStream()) {
                                    byte[] buf = new byte[92160];
                                    int total = 0;
                                    int n;
                                    while (total < buf.length && (n = is.read(buf, total, buf.length - total)) != -1) {
                                        total += n;
                                    }
                                    String rawBody = new String(buf, 0, total, StandardCharsets.UTF_8);
                                    String body = rawBody
                                        .replace("\\u0026", "&")
                                        .replace("\\u003d", "=")
                                        .replace("\\u002f", "/")
                                        .replace("\\/", "/")
                                        .replace("&amp;", "&");
                                    Matcher m = Pattern
                                        .compile("(https://(?:www\\.|maps\\.)?google\\.[a-z.]+/maps[^\"'<>\\s]+|!1d(-?\\d{1,3}\\.\\d{2,15})!2d(-?\\d{1,2}\\.\\d{2,15})|!3d(-?\\d{1,2}\\.\\d{2,15})!4d(-?\\d{1,3}\\.\\d{2,15})|@(-?\\d{1,2}\\.\\d{2,15}),(-?\\d{1,3}\\.\\d{2,15})|staticmap\\?center=(-?\\d{1,2}\\.\\d{2,15})(?:,|%2C)(-?\\d{1,3}\\.\\d{2,15}))")
                                        .matcher(body);
                                    if (m.find()) {
                                        String found = m.group(1);
                                        if (found != null && found.startsWith("https://")) {
                                            current = found;
                                        } else {
                                            String latStr = null;
                                            String lonStr = null;
                                            if (m.group(2) != null && m.group(3) != null) {
                                                lonStr = m.group(2);
                                                latStr = m.group(3);
                                            } else if (m.group(4) != null && m.group(5) != null) {
                                                latStr = m.group(4);
                                                lonStr = m.group(5);
                                            } else if (m.group(6) != null && m.group(7) != null) {
                                                latStr = m.group(6);
                                                lonStr = m.group(7);
                                            } else if (m.group(8) != null && m.group(9) != null) {
                                                latStr = m.group(8);
                                                lonStr = m.group(9);
                                            }
                                            if (latStr != null && lonStr != null) {
                                                int hashIdx = current.indexOf('#');
                                                String base = hashIdx >= 0 ? current.substring(0, hashIdx) : current;
                                                String frag = hashIdx >= 0 ? current.substring(hashIdx) : "";
                                                current = base + (base.contains("?") ? "&" : "?") + "q=" + latStr + "," + lonStr + frag;
                                            }
                                        }
                                    }
                                } catch (Exception ignored) {}
                            }
                            break;
                        }
                    } finally {
                        if (conn != null) {
                            conn.disconnect();
                        }
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
        });
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (activeInstance == this) {
            activeInstance = null;
        }
        try {
            unshortenExecutor.shutdownNow();
        } catch (Exception ignored) {}
        abandonTransientAudioFocus();
        synchronized (ttsLock) {
            pendingUtterances.clear();
            isTtsReady = false;
            isTtsInitializing = false;
            if (tts != null) {
                try {
                    tts.stop();
                    tts.shutdown();
                } catch (Exception ignored) {}
                tts = null;
            }
        }
    }
}
