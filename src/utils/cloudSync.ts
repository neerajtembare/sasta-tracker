import { SavedRide, getGarageRides, importGarageBackup } from './storage';

export interface GistSyncConfig {
  enabled: boolean;
  token: string;
  gistId: string;
  autoSync: boolean;
  lastSyncTime: string | null;
  lastSyncStatus: 'success' | 'error' | null;
  lastSyncMessage?: string;
}

const CONFIG_STORAGE_KEY = 'sasta_cloud_sync_config_v1';

export function getCloudSyncConfig(): GistSyncConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      return {
        enabled: false,
        token: '',
        gistId: '',
        autoSync: false,
        lastSyncTime: null,
        lastSyncStatus: null,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      token: parsed.token || '',
      gistId: parsed.gistId || '',
      autoSync: Boolean(parsed.autoSync),
      lastSyncTime: parsed.lastSyncTime || null,
      lastSyncStatus: parsed.lastSyncStatus || null,
      lastSyncMessage: parsed.lastSyncMessage || '',
    };
  } catch {
    return {
      enabled: false,
      token: '',
      gistId: '',
      autoSync: false,
      lastSyncTime: null,
      lastSyncStatus: null,
    };
  }
}

export function saveCloudSyncConfig(config: Partial<GistSyncConfig>): GistSyncConfig {
  const current = getCloudSyncConfig();
  const updated: GistSyncConfig = {
    ...current,
    ...config,
  };
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save cloud sync config:', err);
  }
  return updated;
}

/**
 * Push current Garage rides to rider's private GitHub Gist
 */
export async function pushGarageToGist(
  customToken?: string,
  customGistId?: string
): Promise<{ success: boolean; gistId: string; count: number; error?: string }> {
  const config = getCloudSyncConfig();
  const token = (customToken || config.token).trim();
  let gistId = (customGistId || config.gistId).trim();

  if (!token) {
    return { success: false, gistId, count: 0, error: 'GitHub Personal Access Token is required.' };
  }

  const rides = getGarageRides();
  const payload = {
    app: 'ThrottleLog',
    version: '1.0.0',
    exportTimestamp: new Date().toISOString(),
    rideCount: rides.length,
    rides,
  };

  const fileContent = JSON.stringify(payload, null, 2);
  const nowFormatted = new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  try {
    if (gistId) {
      // Update existing Gist
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          description: `ThrottleLog Motorcycle Garage Backup (${rides.length} rides) — ${nowFormatted}`,
          files: {
            'throttlelog_garage.json': {
              content: fileContent,
            },
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `GitHub API error (${res.status})`);
      }

      saveCloudSyncConfig({
        enabled: true,
        token,
        gistId,
        lastSyncTime: nowFormatted,
        lastSyncStatus: 'success',
        lastSyncMessage: `Synced ${rides.length} rides to Gist`,
      });

      return { success: true, gistId, count: rides.length };
    } else {
      // Create new secret Gist
      const res = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          description: `ThrottleLog Motorcycle Garage Backup (${rides.length} rides) — ${nowFormatted}`,
          public: false,
          files: {
            'throttlelog_garage.json': {
              content: fileContent,
            },
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `GitHub API error (${res.status})`);
      }

      const json = await res.json();
      const createdId = json.id;

      saveCloudSyncConfig({
        enabled: true,
        token,
        gistId: createdId,
        lastSyncTime: nowFormatted,
        lastSyncStatus: 'success',
        lastSyncMessage: `Created backup Gist with ${rides.length} rides`,
      });

      return { success: true, gistId: createdId, count: rides.length };
    }
  } catch (err: any) {
    const errorMsg = err.message || 'Failed to sync with GitHub Gist';
    saveCloudSyncConfig({
      lastSyncStatus: 'error',
      lastSyncMessage: errorMsg,
    });
    return { success: false, gistId, count: 0, error: errorMsg };
  }
}

/**
 * Pull and merge rides from rider's private GitHub Gist into local Garage
 */
export async function pullGarageFromGist(
  customToken?: string,
  customGistId?: string
): Promise<{ success: boolean; count: number; error?: string }> {
  const config = getCloudSyncConfig();
  const token = (customToken || config.token).trim();
  const gistId = (customGistId || config.gistId).trim();

  if (!token) {
    return { success: false, count: 0, error: 'GitHub Personal Access Token is required.' };
  }
  if (!gistId) {
    return { success: false, count: 0, error: 'Gist ID is required to restore rides.' };
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `GitHub API error (${res.status})`);
    }

    const json = await res.json();
    const backupFile = json.files && (json.files['throttlelog_garage.json'] || json.files['sasta_tracker_garage.json']);
    if (!backupFile || !backupFile.content) {
      throw new Error('Gist does not contain a ThrottleLog backup file.');
    }

    const parsed = JSON.parse(backupFile.content);
    const ridesToImport = Array.isArray(parsed) ? parsed : parsed.rides;

    if (!Array.isArray(ridesToImport) || ridesToImport.length === 0) {
      throw new Error('No valid ride records found inside the cloud backup.');
    }

    const merged = importGarageBackup(ridesToImport);
    const nowFormatted = new Date().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    saveCloudSyncConfig({
      enabled: true,
      token,
      gistId,
      lastSyncTime: nowFormatted,
      lastSyncStatus: 'success',
      lastSyncMessage: `Restored ${ridesToImport.length} rides from Gist`,
    });

    return { success: true, count: merged.length };
  } catch (err: any) {
    const errorMsg = err.message || 'Failed to restore from GitHub Gist';
    saveCloudSyncConfig({
      lastSyncStatus: 'error',
      lastSyncMessage: errorMsg,
    });
    return { success: false, count: 0, error: errorMsg };
  }
}

/**
 * Trigger background auto-sync if rider has enabled it
 */
export function triggerBackgroundAutoSync(): void {
  const config = getCloudSyncConfig();
  if (config.enabled && config.autoSync && config.token && config.gistId) {
    pushGarageToGist().catch(err => {
      console.warn('Background auto-sync notice:', err);
    });
  }
}

// ─── Optional Client-Side AES-GCM Encrypted Backup Export / Import ───
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt Garage rides JSON with password
 */
export async function exportEncryptedGarage(password: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Cryptography API is not supported in this browser.');
  }

  const rides = getGarageRides();
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(rides));

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  const buffer = new Uint8Array(ciphertext);
  const payload = {
    app: 'ThrottleLog Encrypted Backup',
    version: 1,
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(buffer),
    count: rides.length,
    timestamp: new Date().toISOString(),
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Decrypt password-protected Garage backup
 */
export async function importEncryptedGarage(jsonString: string, password: string): Promise<SavedRide[]> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Cryptography API is not supported in this browser.');
  }

  const payload = JSON.parse(jsonString);
  if (!payload.salt || !payload.iv || !payload.data) {
    throw new Error('Invalid encrypted backup file format.');
  }

  const salt = new Uint8Array(payload.salt);
  const iv = new Uint8Array(payload.iv);
  const ciphertext = new Uint8Array(payload.data);

  const key = await deriveKey(password, salt);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    const jsonStr = dec.decode(decrypted);
    const rides = JSON.parse(jsonStr);
    return importGarageBackup(rides);
  } catch {
    throw new Error('Incorrect password or corrupted encrypted backup file.');
  }
}
