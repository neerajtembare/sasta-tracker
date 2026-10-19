package com.throttlelog.app;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Native Android Foreground Service for ThrottleLog.
 * 
 * Runs with FOREGROUND_SERVICE_TYPE_LOCATION and PARTIAL_WAKE_LOCK to guarantee
 * 100% continuous GPS satellite acquisition and trip recording even when:
 * 1. The screen is turned off in a rider's pocket or tank bag.
 * 2. Chromium WebView background timers are throttled by Android OEM battery savers.
 * 3. The rider switches to Google Maps, Spotify, or helmet intercom apps.
 */
public class ThrottleLogKeepAliveService extends Service implements LocationListener {
    public static final String CHANNEL_ID = "throttlelog_radar_channel";
    public static final int NOTIFICATION_ID = 1001;
    
    private PowerManager.WakeLock wakeLock;
    private LocationManager locationManager;
    private NotificationManager notificationManager;
    private boolean isListening = false;
    private double totalDistanceMeters = 0.0;
    private Location lastLocation = null;
    private long lastNotificationUpdateTs = 0;

    public interface LocationCallback {
        void onLocationUpdate(Location location, double totalDistanceMeters);
    }
    public static LocationCallback locationCallback = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = buildStatusNotification("Radar & 100% background GPS active");

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                boolean hasLocationPermission = ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED;

                if (hasLocationPermission) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception ignored) {}
        }

        acquireWakeLock();
        startNativeLocationUpdates();

        return START_STICKY;
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

            // 1. Register GPS Provider (Hardware GNSS satellites: 1000ms / 0.5m)
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    1000L,
                    0.5f,
                    this
                );
                isListening = true;
            }

            // 2. Register Network Provider as fast-lock supplemental provider
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    2000L,
                    2.0f,
                    this
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

    private long lastGpsFixTimestamp = 0;

    @Override
    public void onLocationChanged(@NonNull Location location) {
        String provider = location.getProvider();
        boolean isGps = LocationManager.GPS_PROVIDER.equals(provider);
        long now = System.currentTimeMillis();

        if (isGps) {
            lastGpsFixTimestamp = now;
        } else if (LocationManager.NETWORK_PROVIDER.equals(provider)) {
            // Discard cellular/Wi-Fi triangulation if hardware GPS satellite fix was received recently (< 4500ms)
            if (now - lastGpsFixTimestamp < 4500) {
                return;
            }
            // Discard coarse network fixes with accuracy worse than 35m to eliminate cell-tower jumps
            if (location.hasAccuracy() && location.getAccuracy() > 35.0f) {
                return;
            }
        }

        // Accuracy check for distance accumulation to prevent phantom mileage
        boolean hasGoodAccuracy = !location.hasAccuracy() || location.getAccuracy() <= 45.0f;

        if (hasGoodAccuracy) {
            if (lastLocation != null) {
                float dist = lastLocation.distanceTo(location);
                // Valid motorcycle motion: > 1.5m (avoid jitter while parked) and < 800m (reject anomalous teleports)
                if (dist > 1.5f && dist < 800f) {
                    totalDistanceMeters += dist;
                }
            }
            lastLocation = location;
        }

        // Throttle notification updates to at most once every 2 seconds
        if (now - lastNotificationUpdateTs >= 2000) {
            lastNotificationUpdateTs = now;
            updateNotificationWithLocation(location);
        }

        // Dispatch to Capacitor plugin listener
        if (locationCallback != null) {
            try {
                locationCallback.onLocationUpdate(location, totalDistanceMeters);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(@NonNull String provider) {}

    @Override
    public void onProviderDisabled(@NonNull String provider) {}

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
            .setContentTitle("🏍️ ThrottleLog Radar Active")
            .setContentText(text)
            .setSmallIcon(iconRes)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    private void updateNotificationWithLocation(Location location) {
        if (notificationManager == null) return;
        try {
            float speedKmh = location.hasSpeed() ? location.getSpeed() * 3.6f : 0f;
            double distKm = totalDistanceMeters / 1000.0;
            float acc = location.hasAccuracy() ? location.getAccuracy() : 0f;

            String dynamicText = String.format(
                java.util.Locale.US,
                "🏍️ %d km/h • %.1f km • ±%.0fm GPS",
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
                    // 12-hour max safety duration for endurance rides
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
        stopNativeLocationUpdates();
        releaseWakeLock();
        locationCallback = null;
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
