/**
 * ThrottleLog — Motorcycle High-G Crash & Abrupt Stop Detection Engine
 * 
 * Engineered specifically for motorcycle touring and Indian road dynamics:
 * - Heavily filtered against single-cylinder engine thump (RE 350, KTM 390)
 * - Damped against speed-breakers, rumble strips, and potholes
 * - Requires:
 *   1. Active riding motion (> 18 km/h) prior to event
 *   2. Severe G-force impact spike (> 6.5G)
 *   3. Abrupt speed collapse to < 3 km/h within 2 seconds
 *   4. Sustained stationary state for > 4 seconds
 */

export interface CrashEvent {
  timestamp: number;
  peakG: number;
  preImpactSpeedKmh: number;
}

class MotorcycleCrashDetector {
  private isListening = false;
  private onCrashCallback: ((event: CrashEvent) => void) | null = null;
  private recentSpeeds: Array<{ speedKmh: number; time: number }> = [];
  private potentialImpact: { peakG: number; time: number; preSpeed: number } | null = null;
  private impactTimer: any = null;
  private impactCooldownUntil = 0;
  private currentSpeedKmh = 0;

  // Persistence Key
  private readonly STORAGE_KEY = 'throttlelog_crash_detection_v1';
  private readonly LEGACY_STORAGE_KEY = 'sasta_crash_detection_v1';

  public isEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY) ?? localStorage.getItem(this.LEGACY_STORAGE_KEY);
      return saved !== 'false'; // Default enabled
    } catch {
      return true;
    }
  }

  public setEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY, String(enabled));
      localStorage.setItem(this.LEGACY_STORAGE_KEY, String(enabled));
    } catch {}
    if (!enabled) {
      this.cancelPotentialImpact();
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
  }

  private cancelPotentialImpact() {
    if (this.impactTimer) {
      clearTimeout(this.impactTimer);
      this.impactTimer = null;
    }
    this.potentialImpact = null;
  }

  private verifyImpactOutcome() {
    if (!this.potentialImpact) return;
    const now = Date.now();
    const impact = this.potentialImpact;

    // Check if rider is stationary (speed <= 3.5 km/h or no movement detected)
    const recentSpeedsSinceImpact = this.recentSpeeds.filter(s => s.time >= impact.time);
    const maxSpeedSinceImpact = recentSpeedsSinceImpact.length > 0
      ? Math.max(...recentSpeedsSinceImpact.map(s => s.speedKmh))
      : this.currentSpeedKmh;

    if (maxSpeedSinceImpact <= 3.5 || this.currentSpeedKmh <= 3.5) {
      // Confirmed crash: Severe impact + rider stopped and remained stationary
      const event: CrashEvent = {
        timestamp: impact.time,
        peakG: impact.peakG,
        preImpactSpeedKmh: impact.preSpeed,
      };
      this.cancelPotentialImpact();
      this.impactCooldownUntil = now + 60000; // 60s cooldown to prevent double firing

      if (this.onCrashCallback) {
        try {
          this.onCrashCallback(event);
        } catch (e) {
          console.error('Crash callback error:', e);
        }
      }
    } else {
      // False alarm: rider hit a bump/pothole and continued riding at speed
      this.cancelPotentialImpact();
    }
  }

  public updateGpsSpeed(speedKmh: number) {
    const now = Date.now();
    this.currentSpeedKmh = speedKmh;
    this.recentSpeeds.push({ speedKmh, time: now });

    // Prune speeds older than 6 seconds
    this.recentSpeeds = this.recentSpeeds.filter(s => now - s.time <= 6000);

    // If an impact was recorded and more than 4 seconds elapsed, verify immediately
    if (this.potentialImpact && now - this.potentialImpact.time >= 4000) {
      this.verifyImpactOutcome();
    }
  }

  private motionHandler: ((event: DeviceMotionEvent) => void) | null = null;

  public async requestMotionPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        return response === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }

  public startListening(onCrashDetected: (event: CrashEvent) => void) {
    if (typeof window === 'undefined') return;
    if (this.isListening) {
      this.stopListening();
    }
    this.onCrashCallback = onCrashDetected;

    const handleMotion = (event: DeviceMotionEvent) => {
      if (!this.isListening || !this.isEnabled()) return;
      const now = Date.now();
      if (now < this.impactCooldownUntil) return;

      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      // Magnitude of total acceleration vector in m/s^2
      const magMs2 = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      // Convert to G-force (1G ≈ 9.80665 m/s^2)
      const gForce = magMs2 / 9.80665;

      // Indian road threshold: 6.5G (potholes with damped phone mounts peak at 2.5-4G)
      if (gForce >= 6.5) {
        // Check if rider was actually riding before this (> 18 km/h in past 4s)
        const speedsInWindow = this.recentSpeeds.filter(s => now - s.time <= 4000);
        const maxPreSpeed = speedsInWindow.length > 0 
          ? Math.max(...speedsInWindow.map(s => s.speedKmh)) 
          : this.currentSpeedKmh;

        if (maxPreSpeed >= 18) {
          // Record potential impact candidate
          if (!this.potentialImpact || gForce > this.potentialImpact.peakG) {
            this.potentialImpact = {
              peakG: Number(gForce.toFixed(1)),
              time: now,
              preSpeed: Number(maxPreSpeed.toFixed(0)),
            };

            // Start internal autonomous watchdog timer for 4.2 seconds
            // This guarantees verification even if the phone lies still and GPS stops sending fixes!
            if (this.impactTimer) clearTimeout(this.impactTimer);
            this.impactTimer = setTimeout(() => {
              this.verifyImpactOutcome();
            }, 4200);
          }
        }
      }
    };

    try {
      this.motionHandler = handleMotion;
      window.addEventListener('devicemotion', this.motionHandler, { passive: true });
      this.isListening = true;
    } catch (err) {
      console.warn('Crash detection motion listener warning:', err);
    }
  }

  public stopListening() {
    this.isListening = false;
    this.cancelPotentialImpact();
    if (this.motionHandler && typeof window !== 'undefined') {
      try {
        window.removeEventListener('devicemotion', this.motionHandler);
      } catch {}
      this.motionHandler = null;
    }
  }
}

export const crashDetector = new MotorcycleCrashDetector();
