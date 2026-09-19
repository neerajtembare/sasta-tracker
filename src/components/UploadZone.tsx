import React, { useRef, useState } from 'react';
import { Upload, Sparkles, AlertCircle } from 'lucide-react';
import { AppTheme } from '../types';

interface UploadZoneProps {
  onFileLoaded: (xmlText: string, fileName: string) => void;
  onLoadSample: () => void;
  currentRideName?: string;
  theme?: AppTheme;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileLoaded,
  onLoadSample,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setErrorMsg(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.gpx') && !file.type.includes('xml')) {
      setErrorMsg('Please select a valid .gpx or XML file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        try {
          onFileLoaded(content, file.name.replace(/\.[^/.]+$/, ''));
        } catch (err: any) {
          setErrorMsg(err.message || 'Error parsing GPX file');
        }
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const cardStyle = isLight
    ? isDragging
      ? 'border-sky-500 bg-sky-50 shadow-[0_0_25px_rgba(14,165,233,0.2)]'
      : 'border-slate-300 bg-white hover:border-sky-400 hover:bg-slate-50 text-slate-800'
    : isDragging
    ? 'border-sky-500 bg-sky-950/20 shadow-[0_0_25px_rgba(56,189,248,0.2)]'
    : 'border-[#1e2a38] bg-[#0d131a] hover:border-sky-500/50 hover:bg-[#131b24] text-slate-200';

  const iconBg = isLight
    ? 'bg-sky-50 border-sky-200 text-sky-600'
    : 'bg-[#131b24] border-[#1e2a38] text-sky-400';

  const subText = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';

  const sampleBtn = isLight
    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-sky-700'
    : 'bg-[#131b24] hover:bg-[#1c2633] border-sky-500/40 text-sky-400';

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        accept=".gpx,application/gpx+xml,text/xml"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full p-5 sm:p-7 border-2 border-dashed rounded-2xl transition-all cursor-pointer text-center shadow-lg ${cardStyle}`}
      >
        <div className={`w-12 h-12 mx-auto mb-3 border rounded-xl flex items-center justify-center transition-transform hover:scale-105 ${iconBg}`}>
          <Upload className="w-6 h-6" />
        </div>
        <h4 className="font-heading font-bold text-sm uppercase tracking-wider mb-1.5">
          Drag & Drop GPX Ride Log or Click to Browse
        </h4>
        <p className={`text-xs font-mono max-w-md mx-auto mb-4 ${subText}`}>
          Compatible with GPSLogger, Garmin, Strava, OsmAnd, Komoot & motorcycle GPS trackers.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onLoadSample();
            }}
            className={`px-3.5 py-1.5 border rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-sm ${sampleBtn}`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Sample Ride</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/40 text-rose-400 font-mono text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
