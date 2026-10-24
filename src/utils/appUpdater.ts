/**
 * ThrottleLog — In-App APK Update Checker
 * 
 * Checks GitHub Releases API for newly built APK releases and allows riders
 * to 1-tap download and update their APK in-place without losing saved rides or garage logs.
 */

export const CURRENT_APP_VERSION = '1.3.0';
export const GITHUB_REPO = 'neerajtembare/sasta-tracker';
export const DIRECT_APK_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/throttlelog.apk`;
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

export interface AppUpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  downloadUrl: string;
  releaseNotes?: string;
  publishedAt?: string;
}

function parseSemVer(v: string): number[] {
  const clean = v.replace(/^v/i, '').trim();
  const parts = clean.split('.').map(p => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts;
}

function isNewerVersion(latest: string, current: string): boolean {
  const l = parseSemVer(latest);
  const c = parseSemVer(current);
  for (let i = 0; i < 3; i++) {
    if (l[i] > c[i]) return true;
    if (l[i] < c[i]) return false;
  }
  return false;
}

export async function checkAppForUpdates(): Promise<AppUpdateCheckResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        updateAvailable: false,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: CURRENT_APP_VERSION,
        releaseName: `ThrottleLog v${CURRENT_APP_VERSION}`,
        downloadUrl: DIRECT_APK_DOWNLOAD_URL,
      };
    }

    const data = await response.json();
    const rawTag = (data.tag_name || '').trim();
    const cleanTag = rawTag.replace(/^v/i, '') || CURRENT_APP_VERSION;
    const hasUpdate = isNewerVersion(cleanTag, CURRENT_APP_VERSION);

    // Look for attached APK asset or fallback to latest download link
    let apkDownload = DIRECT_APK_DOWNLOAD_URL;
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const releaseAsset = data.assets.find((a: any) => a.name && a.name.endsWith('.apk') && !a.name.includes('debug'));
      if (releaseAsset?.browser_download_url) {
        apkDownload = releaseAsset.browser_download_url;
      }
    }

    return {
      updateAvailable: hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: cleanTag,
      releaseName: data.name || `ThrottleLog v${cleanTag}`,
      downloadUrl: apkDownload,
      releaseNotes: data.body || '',
      publishedAt: data.published_at,
    };
  } catch (err) {
    console.warn('App update check warning:', err);
    return {
      updateAvailable: false,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: CURRENT_APP_VERSION,
      releaseName: `ThrottleLog v${CURRENT_APP_VERSION}`,
      downloadUrl: DIRECT_APK_DOWNLOAD_URL,
    };
  }
}
