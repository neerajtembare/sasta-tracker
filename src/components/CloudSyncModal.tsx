import React, { useState, useEffect } from 'react';
import { AppTheme } from '../types';
import { 
  getCloudSyncConfig, 
  saveCloudSyncConfig, 
  pushGarageToGist, 
  pullGarageFromGist, 
  exportEncryptedGarage, 
  importEncryptedGarage,
  GistSyncConfig 
} from '../utils/cloudSync';
import { getGarageRides } from '../utils/storage';
import { downloadFile } from '../utils/gpxExporter';
import { 
  Cloud, 
  CloudRain, 
  UploadCloud, 
  DownloadCloud, 
  Key, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck, 
  FileText,
  Sparkles
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRidesUpdated?: () => void;
  theme?: AppTheme;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onRidesUpdated,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  const [config, setConfig] = useState<GistSyncConfig>(getCloudSyncConfig());
  const [tokenInput, setTokenInput] = useState('');
  const [gistIdInput, setGistIdInput] = useState('');
  const [autoSync, setAutoSync] = useState(false);

  // Status & feedback
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Encryption Vault
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultSuccess, setVaultSuccess] = useState<string | null>(null);
  const encryptedFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getCloudSyncConfig();
      setConfig(current);
      setTokenInput(current.token);
      setGistIdInput(current.gistId);
      setAutoSync(current.autoSync);
      setStatusMessage(null);
      setVaultPassword('');
      setVaultError(null);
      setVaultSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const ridesCount = getGarageRides().length;

  const handleSaveConfig = () => {
    triggerHaptic(40);
    const updated = saveCloudSyncConfig({
      token: tokenInput.trim(),
      gistId: gistIdInput.trim(),
      autoSync,
      enabled: Boolean(tokenInput.trim()),
    });
    setConfig(updated);
    setStatusMessage({ type: 'info', text: 'Cloud credentials saved locally.' });
  };

  const handlePushToCloud = async () => {
    triggerHaptic(50);
    if (!tokenInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a GitHub Personal Access Token.' });
      return;
    }
    setIsSyncing(true);
    setStatusMessage({ type: 'info', text: 'Uploading garage rides to your private Gist...' });

    const res = await pushGarageToGist(tokenInput.trim(), gistIdInput.trim());
    setIsSyncing(false);

    if (res.success) {
      triggerHaptic([60, 40, 60]);
      setGistIdInput(res.gistId);
      setConfig(getCloudSyncConfig());
      setStatusMessage({
        type: 'success',
        text: `Successfully backed up ${res.count} rides to your private Gist!`,
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to sync with GitHub Gist.',
      });
    }
  };

  const handlePullFromCloud = async () => {
    triggerHaptic(50);
    if (!tokenInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your GitHub Personal Access Token.' });
      return;
    }
    if (!gistIdInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your existing Gist ID to restore from.' });
      return;
    }
    setIsSyncing(true);
    setStatusMessage({ type: 'info', text: 'Fetching and merging rides from your cloud Gist...' });

    const res = await pullGarageFromGist(tokenInput.trim(), gistIdInput.trim());
    setIsSyncing(false);

    if (res.success) {
      triggerHaptic([60, 40, 60]);
      setConfig(getCloudSyncConfig());
      if (onRidesUpdated) onRidesUpdated();
      setStatusMessage({
        type: 'success',
        text: `Restored & merged! Garage now contains ${res.count} total rides.`,
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to pull from GitHub Gist.',
      });
    }
  };

  // ─── AES-GCM Encrypted Vault Export ───
  const handleExportEncrypted = async () => {
    triggerHaptic(40);
    setVaultError(null);
    setVaultSuccess(null);

    if (!vaultPassword || vaultPassword.length < 4) {
      setVaultError('Password must be at least 4 characters long.');
      return;
    }

    try {
      const payload = await exportEncryptedGarage(vaultPassword);
      const filename = `sasta_garage_encrypted_${new Date().toISOString().slice(0, 10)}.enc.json`;
      downloadFile(payload, filename, 'application/json');
      setVaultSuccess('Encrypted vault exported! Keep your password safe to restore.');
    } catch (err: any) {
      setVaultError(err.message || 'Encryption failed');
    }
  };

  // ─── AES-GCM Encrypted Vault Restore ───
  const handleImportEncryptedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVaultError(null);
    setVaultSuccess(null);

    if (!vaultPassword || vaultPassword.length < 4) {
      setVaultError('Enter the password for this encrypted backup before restoring.');
      if (encryptedFileInputRef.current) encryptedFileInputRef.current.value = '';
      return;
    }

    try {
      const text = await file.text();
      const restored = await importEncryptedGarage(text, vaultPassword);
      triggerHaptic([50, 40, 50]);
      setVaultSuccess(`Successfully decrypted and restored ${restored.length} rides into your garage!`);
      if (onRidesUpdated) onRidesUpdated();
    } catch (err: any) {
      setVaultError(err.message || 'Decryption failed. Check password.');
    } finally {
      if (encryptedFileInputRef.current) encryptedFileInputRef.current.value = '';
    }
  };

  const modalBg = isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0d131a] border-[#1e2a38] text-white';
  const subTextColor = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const cardBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const inputBg = isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0a0f15] border-[#223142] text-white';

  return (
    <div 
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn cursor-pointer"
    >
      <div 
        onClick={e => e.stopPropagation()}
        className={`border rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden cursor-default ${modalBg}`}
      >
        
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <span>Personal Cloud Backup & Sync</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  100% FREE
                </span>
              </h3>
              <p className={`text-[11px] font-mono ${subTextColor}`}>
                Zero monthly server bills • Back up to your own private GitHub Gist
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-700/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs font-mono">
          
          {/* Status Bar */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${cardBg}`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${config.lastSyncStatus === 'success' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'}`} />
              <div>
                <p className="font-bold text-xs">
                  {config.lastSyncStatus === 'success' ? 'Cloud Sync Active' : 'Local Garage Only'}
                </p>
                <p className={`text-[11px] ${subTextColor}`}>
                  {config.lastSyncTime 
                    ? `Last synced: ${config.lastSyncTime}` 
                    : `${ridesCount} rides currently saved on this device`}
                </p>
              </div>
            </div>
            {config.gistId && (
              <a
                href={`https://gist.github.com/${config.gistId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-sky-400 hover:underline shrink-0"
              >
                <span>View Gist</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Feedback Message */}
          {statusMessage && (
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              statusMessage.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              'bg-sky-500/10 border-sky-500/30 text-sky-300'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span className="text-xs">{statusMessage.text}</span>
            </div>
          )}

          {/* GitHub Gist Configuration Card */}
          <div className={`p-4 rounded-xl border space-y-3.5 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-xs uppercase tracking-wider">GitHub Secret Gist Sync</span>
              </div>
              <a
                href="https://github.com/settings/tokens/new?description=Sasta+Tracker+Backup&scopes=gist"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>Get Token (30s)</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
              Enter a GitHub Personal Access Token with <span className="text-sky-300">gist</span> scope. ThrottleLog will store a private <code className="text-amber-300">throttlelog_garage.json</code> backup directly under your account.
            </p>

            {/* Token Input */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">GitHub Personal Access Token (PAT):</label>
              <input
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className={`w-full py-2 px-3 rounded-lg border text-xs font-mono focus:outline-none focus:border-sky-400 ${inputBg}`}
              />
            </div>

            {/* Gist ID Input */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Gist ID <span className="text-slate-500">(Leave blank to auto-create on first sync)</span>:
              </label>
              <input
                type="text"
                value={gistIdInput}
                onChange={e => setGistIdInput(e.target.value)}
                placeholder="e.g. 8a3f9104b2c1..."
                className={`w-full py-2 px-3 rounded-lg border text-xs font-mono focus:outline-none focus:border-sky-400 ${inputBg}`}
              />
            </div>

            {/* Auto-Sync Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={e => setAutoSync(e.target.checked)}
                className="rounded border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-xs text-slate-300">
                Auto-sync newly saved rides to Gist in the background
              </span>
            </label>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap gap-2.5">
              <button
                onClick={handlePushToCloud}
                disabled={isSyncing}
                className="flex-1 min-w-[130px] py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isSyncing ? 'Syncing...' : 'Sync to Cloud'}</span>
              </button>

              <button
                onClick={handlePullFromCloud}
                disabled={isSyncing || !gistIdInput.trim()}
                className="flex-1 min-w-[130px] py-2.5 px-3 rounded-xl border border-sky-500/40 hover:bg-sky-500/10 text-sky-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>Restore from Cloud</span>
              </button>

              <button
                onClick={handleSaveConfig}
                className="py-2.5 px-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs transition-colors cursor-pointer"
              >
                Save Credentials
              </button>
            </div>
          </div>

          {/* Client-Side AES-GCM Encrypted Vault Section */}
          <div className={`p-4 rounded-xl border space-y-3.5 ${cardBg}`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-xs uppercase tracking-wider">
                Encrypted Offline Vault (AES-GCM 256-bit)
              </span>
            </div>

            <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
              Want military-grade privacy? Encrypt your garage coordinates with a custom password before uploading to Google Drive or emailing to a friend.
            </p>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Vault Password:</label>
              <input
                type="password"
                value={vaultPassword}
                onChange={e => setVaultPassword(e.target.value)}
                placeholder="Enter password to encrypt or decrypt..."
                className={`w-full py-2 px-3 rounded-lg border text-xs font-mono focus:outline-none focus:border-emerald-400 ${inputBg}`}
              />
            </div>

            {vaultError && (
              <p className="text-[11px] text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{vaultError}</span>
              </p>
            )}

            {vaultSuccess && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{vaultSuccess}</span>
              </p>
            )}

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                onClick={handleExportEncrypted}
                className="flex-1 min-w-[130px] py-2 px-3 rounded-lg border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Export Encrypted Vault</span>
              </button>

              <button
                onClick={() => encryptedFileInputRef.current?.click()}
                className="flex-1 min-w-[130px] py-2 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Restore Encrypted Vault</span>
              </button>

              <input
                type="file"
                ref={encryptedFileInputRef}
                onChange={handleImportEncryptedFile}
                accept=".json,.enc.json"
                className="hidden"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t flex items-center justify-between text-[11px] font-mono bg-slate-950/40">
          <span className={subTextColor}>End-to-end user custody • Zero cloud vendor lock-in</span>
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
