package com.throttlelog.app;

import android.annotation.SuppressLint;
import android.app.ForegroundServiceStartNotAllowedException;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Native Android Foreground Service for ThrottleLog.
 *
 * Runs with FOREGROUND_SERVICE_TYPE_LOCATION and PARTIAL_WAKE_LOCK to guarantee
 * continuous GPS satellite acquisition, 50Hz accelerometer crash detection, and
 * trip recording even when the screen is off or Chromium timers are throttled.
 */
public class ThrottleLogKeepAliveService extends Service implements LocationListener, SensorEventListener {
    public static final String CHANNEL_ID = "throttlelog_radar_channel";
    public static final int NOTIFICATION_ID = 1001;
    public static final String EXTRA_RESET_ODOMETER = "resetOdometer";
    public static final String EXTRA_CRASH_ENABLED = "crashDetectionEnabled";

    private PowerManager.WakeLock wakeLock;
    private LocationManager locationManager;
    private NotificationManager notificationManager;
    private SensorManager sensorManager;
    private Sensor accelerometer;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private HandlerThread gpsHandlerThread;
    private Looper gpsLooper;

    private final Object stateLock = new Object();
    private Runnable crashWatchdogRunnable = null;
    private double potentialImpactPeakG = 0.0;
    private double potentialImpactPreSpeedKmh = 0.0;
    private long impactCooldownUntil = 0;
    private boolean isListening = false;
    private double totalDistanceMeters = 0.0;
    private Location lastLocation = null;
    private volatile long lastGpsFixTimestamp = 0;
    private long lastNotificationUpdateTs = 0;

    private static volatile boolean crashDetectionEnabled = true;
    private static volatile ThrottleLogKeepAliveService runningInstance = null;

    public interface LocationCallback {
        void onLocationUpdate(Location location, double totalDistanceMeters);
    }
    public static volatile LocationCallback locationCallback = null;

    public interface CrashCallback {
        void onNativeCrashDetected(double peakG, double preSpeedKmh);
    }
    public static volatile CrashCallback crashCallback = null;

    public static void setCrashDetectionEnabled(boolean enabled) {
        crashDetectionEnabled = enabled;
        ThrottleLogKeepAliveService inst = runningInstance;
        if (inst != null && !enabled) {
            inst.cancelPendingCrashWatchdog();
        }
    }

    private void cancelPendingCrashWatchdog() {
        mainHandler.post(() -> {
            if (crashWatchdogRunnable != null) {
                mainHandler.removeCallbacks(crashWatchdogRunnable);
                crashWatchdogRunnable = null;
            }
        });
    }

    @Override
    public void onCreate() {
        super.onCreate();
        runningInstance = this;
        createNotificationChannel();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        gpsHandlerThread = new HandlerThread("ThrottleLogGpsThread", android.os.Process.THREAD_PRIORITY_MORE_FAVORABLE);
        gpsHandlerThread.start();
        gpsLooper = gpsHandlerThread.getLooper();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            if (intent.getBooleanExtra(EXTRA_RESET_ODOMETER, false)) {
                synchronized (stateLock) {
                    totalDistanceMeters = 0.0;
                    lastLocation = null;
                }
            }
            if (intent.hasExtra(EXTRA_CRASH_ENABLED)) {
                setCrashDetectionEnabled(intent.getBooleanExtra(EXTRA_CRASH_ENABLED, true));
            }
        }

        Notification notification = buildStatusNotification("Radar & background GPS active");

        boolean hasLocationPermission =
            ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (!hasLocationPermission) {
            android.util.Log.w("ThrottleLogService", "Location permission missing; refusing location foreground service start.");
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && e instanceof ForegroundServiceStartNotAllowedException) {
                android.util.Log.e("ThrottleLogService", "Android 12+ blocked foreground start from background: " + e.getMessage());
            } else if (e instanceof SecurityException) {
                android.util.Log.e("ThrottleLogService", "SecurityException starting location FGS: " + e.getMessage());
            } else {
                android.util.Log.e("ThrottleLogService", "Failed to start foreground service: " + e.getMessage());
            }
            stopSelf();
            return START_NOT_STICKY;
        }

        acquireWakeLock();
        startNativeLocationUpdates();
        startNativeSensors();

        return START_STICKY;
    }

    private void startNativeSensors() {
        try {
            if (sensorManager != null) return;
            sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
            if (sensorManager != null) {
                accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
                if (accelerometer != null) {
                    // ~50Hz sampling rate to reliably capture 20-50ms collision impulses
                    sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
                }
            }
        } catch (Exception e) {
            android.util.Log.w("ThrottleLogService", "Native accelerometer listener init error: " + e.getMessage());
        }
    }

    private void stopNativeSensors() {
        try {
            if (sensorManager != null) {
                sensorManager.unregisterListener(this);
                sensorManager = null;
            }
            cancelPendingCrashWatchdog();
        } catch (Exception ignored) {}
    }

    @SuppressLint("MissingPermission")
    private void startNativeLocationUpdates() {
        if (isListening) return;
        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) return;

            boolean hasFine = ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            boolean hasCoarse = ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            if (!hasFine && !hasCoarse) return;

            Looper targetLooper = gpsLooper != null ? gpsLooper : Looper.getMainLooper();

            // 1. Hardware GNSS Satellite Provider (1000ms / 0.5m) on background Looper
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    1000L,
                    0.5f,
                    this,
                    targetLooper
                );
                isListening = true;
            }

            // 2. Network Provider as supplemental quick fix on background Looper
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    2000L,
                    2.0f,
                    this,
                    targetLooper
                );
                isListening = true;
            }
        } catch (Exception e) {
            android.util.Log.w("ThrottleLogService", "Could not start native GPS listener: " + e.getMessage());
        }
    }

    private void stopNativeLocationUpdates() {
        if (locationManager != null && isListening) {
            try {
                locationManager.removeUpdates(this);
            } catch (Exception ignored) {}
            isListening = false;
        }
    }

    @Override
    public void onLocationChanged(@NonNull Location location) {
        String provider = location.getProvider();
        boolean isGps = LocationManager.GPS_PROVIDER.equals(provider);
        long now = System.currentTimeMillis();

        if (isGps) {
            lastGpsFixTimestamp = now;
        } else if (LocationManager.NETWORK_PROVIDER.equals(provider)) {
            if (now - lastGpsFixTimestamp < 4500) {
                return;
            }
            if (location.hasAccuracy() && location.getAccuracy() > 35.0f) {
                return;
            }
        }

        boolean hasGoodAccuracy = !location.hasAccuracy() || location.getAccuracy() <= 45.0f;
        double currentTotalDist;

        synchronized (stateLock) {
            if (hasGoodAccuracy) {
                if (lastLocation != null) {
                    float dist = lastLocation.distanceTo(location);
                    // Valid motion window aligned with JS engine: > 1.5m jitter band, < 1500m teleport filter
                    if (dist > 1.5f && dist < 1500f) {
                        totalDistanceMeters += dist;
                    }
                }
                lastLocation = location;
            }
            currentTotalDist = totalDistanceMeters;
        }

        if (now - lastNotificationUpdateTs >= 2000) {
            lastNotificationUpdateTs = now;
            updateNotificationWithLocation(location, currentTotalDist);
        }

        LocationCallback cb = locationCallback;
        if (cb != null) {
            try {
                cb.onLocationUpdate(location, currentTotalDist);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onProviderDisabled(@NonNull String provider) {}

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!crashDetectionEnabled || event == null || event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) return;
        long now = System.currentTimeMillis();
        if (now < impactCooldownUntil) return;

        float ax = event.values[0];
        float ay = event.values[1];
        float az = event.values[2];
        double magMs2 = Math.sqrt(ax * ax + ay * ay + az * az);
        double gForce = magMs2 / 9.80665;

        if (gForce >= 6.5) {
            Location snapshotLoc;
            synchronized (stateLock) {
                snapshotLoc = lastLocation;
            }
            float speedKmh = (snapshotLoc != null && snapshotLoc.hasSpeed()) ? snapshotLoc.getSpeed() * 3.6f : 0f;
            if (speedKmh >= 18f) {
                final double peakRounded = Math.round(gForce * 10.0) / 10.0;
                final double preRounded = Math.round(speedKmh);

                mainHandler.post(() -> {
                    if (!crashDetectionEnabled) return;
                    if (crashWatchdogRunnable == null || peakRounded > potentialImpactPeakG) {
                        potentialImpactPeakG = peakRounded;
                        potentialImpactPreSpeedKmh = preRounded;

                        if (crashWatchdogRunnable != null) {
                            mainHandler.removeCallbacks(crashWatchdogRunnable);
                        }

                        crashWatchdogRunnable = () -> {
                            crashWatchdogRunnable = null;
                            if (!crashDetectionEnabled) return;

                            Location postLoc;
                            synchronized (stateLock) {
                                postLoc = lastLocation;
                            }
                            float postSpeedKmh = (postLoc != null && postLoc.hasSpeed()) ? postLoc.getSpeed() * 3.6f : 0f;
                            boolean gpsLostAfterImpact = lastGpsFixTimestamp > 0 && (System.currentTimeMillis() - lastGpsFixTimestamp) >= 3200;

                            if (gpsLostAfterImpact || postSpeedKmh <= 3.5f) {
                                impactCooldownUntil = System.currentTimeMillis() + 60000;
                                CrashCallback cb = crashCallback;
                                if (cb != null) {
                                    try {
                                        cb.onNativeCrashDetected(potentialImpactPeakG, potentialImpactPreSpeedKmh);
                                    } catch (Exception ignored) {}
                                }
                            }
                        };
                        mainHandler.postDelayed(crashWatchdogRunnable, 4000);
                    }
                });
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private Notification buildStatusNotification(String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setAction(Intent.ACTION_MAIN);
        notificationIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        int iconRes = getApplicationInfo().icon != 0 ? getApplicationInfo().icon : android.R.drawable.ic_menu_compass;

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ThrottleLog Radar Active")
            .setContentText(text)
            .setSmallIcon(iconRes)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    private void updateNotificationWithLocation(Location location, double distMeters) {
        if (notificationManager == null) return;
        try {
            float speedKmh = location.hasSpeed() ? location.getSpeed() * 3.6f : 0f;
            double distKm = distMeters / 1000.0;
            float acc = location.hasAccuracy() ? location.getAccuracy() : 0f;

            String dynamicText = String.format(
                java.util.Locale.US,
                "%d km/h • %.1f km • ±%.0fm GPS",
                Math.round(speedKmh),
                distKm,
                acc
            );

            Notification updatedNotification = buildStatusNotification(dynamicText);
            notificationManager.notify(NOTIFICATION_ID, updatedNotification);
        } catch (Exception ignored) {}
    }

    private void acquireWakeLock() {
        if (wakeLock == null || !wakeLock.isHeld()) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ThrottleLog:RadarWakeLock");
                    wakeLock.acquire(12 * 60 * 60 * 1000L);
                }
            } catch (Exception ignored) {}
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
            wakeLock = null;
        }
    }

    @Override
    public void onDestroy() {
        runningInstance = null;
        stopNativeLocationUpdates();
        stopNativeSensors();
        releaseWakeLock();
        if (gpsHandlerThread != null) {
            try {
                gpsHandlerThread.quitSafely();
            } catch (Exception ignored) {}
            gpsHandlerThread = null;
            gpsLooper = null;
        }
        locationCallback = null;
        crashCallback = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                CHANNEL_ID,
                "ThrottleLog Radar Active",
                NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Keeps ThrottleLog radar & GPS telemetry alive when using Google Maps or music");
            serviceChannel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }
}
