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

    private TextToSpeech tts;
    private boolean isTtsReady = false;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;

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

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
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
