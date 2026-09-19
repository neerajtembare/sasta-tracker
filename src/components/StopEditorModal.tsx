import React, { useState } from 'react';
import { PitStop, PitStopCategory, TrackPoint, AppTheme } from '../types';
import { 
  X, 
  Coffee, 
  Fuel, 
  Utensils, 
  Camera, 
  Wrench, 
  Clock, 
  MapPin, 
  Save, 
  Trash2, 
  AlertTriangle,
  FileText
} from 'lucide-react';

interface StopEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  stopToEdit: PitStop | null;
  onSaveStop: (stop: PitStop) => void;
  onDeleteStop: (stopId: string) => void;
  defaultPoint?: TrackPoint | null;
  totalDistanceKm: number;
  theme?: AppTheme;
}

export const STOP_CATEGORIES: { id: PitStopCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'chai', label: 'Chai / Tea Break', icon: <Coffee className="w-4 h-4" />, color: '#f59e0b' },
  { id: 'fuel', label: 'Petrol / Fuel Refill', icon: <Fuel className="w-4 h-4" />, color: '#06b6d4' },
  { id: 'dhaba', label: 'Food / Dhaba / Meal', icon: <Utensils className="w-4 h-4" />, color: '#10b981' },
  { id: 'scenic', label: 'Photo / Viewpoint', icon: <Camera className="w-4 h-4" />, color: '#a855f7' },
  { id: 'rest', label: 'Quick Rest / Stretch', icon: <Clock className="w-4 h-4" />, color: '#38bdf8' },
  { id: 'mechanic', label: 'Repair / Puncture', icon: <Wrench className="w-4 h-4" />, color: '#ef4444' },
  { id: 'traffic', label: 'Traffic / Toll Plaza', icon: <AlertTriangle className="w-4 h-4" />, color: '#f97316' },
  { id: 'other', label: 'Other Stop', icon: <MapPin className="w-4 h-4" />, color: '#94a3b8' },
];

export const StopEditorModal: React.FC<StopEditorModalProps> = ({
  isOpen,
  onClose,
  stopToEdit,
  onSaveStop,
  onDeleteStop,
  defaultPoint,
  totalDistanceKm,
  theme = 'dark',
}) => {
  if (!isOpen) return null;

  const isLight = theme === 'light';
  const isEditing = !!stopToEdit;

  const [category, setCategory] = useState<PitStopCategory>(
    stopToEdit ? stopToEdit.category : 'chai'
  );
  const [name, setName] = useState<string>(
    stopToEdit ? stopToEdit.name : (defaultPoint ? `Stop at ${defaultPoint.distanceFromStartKm.toFixed(1)} km` : 'Chai & Snack Break')
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(
    stopToEdit ? Math.max(1, Math.round(stopToEdit.durationSeconds / 60)) : 15
  );
  const [notes, setNotes] = useState<string>(stopToEdit?.notes || '');
  const [distanceKm, setDistanceKm] = useState<number>(
    stopToEdit ? stopToEdit.distanceKm : (defaultPoint ? defaultPoint.distanceFromStartKm : 0)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stop: PitStop = {
      id: stopToEdit ? stopToEdit.id : `stop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      category,
      name: name.trim() || 'Quick Stop',
      notes: notes.trim() || undefined,
      durationSeconds: Math.max(60, durationMinutes * 60),
      distanceKm: Math.min(totalDistanceKm, Math.max(0, distanceKm)),
      lat: stopToEdit ? stopToEdit.lat : (defaultPoint ? defaultPoint.lat : 0),
      lon: stopToEdit ? stopToEdit.lon : (defaultPoint ? defaultPoint.lon : 0),
      ele: stopToEdit ? stopToEdit.ele : (defaultPoint ? defaultPoint.ele : null),
      startTime: stopToEdit ? stopToEdit.startTime : (defaultPoint?.time || new Date().toISOString()),
      segmentIndex: stopToEdit ? stopToEdit.segmentIndex : (defaultPoint?.segmentIndex || 0),
    };

    onSaveStop(stop);
    onClose();
  };

  const handleQuickDuration = (mins: number) => {
    setDurationMinutes(mins);
  };

  const modalBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/80';
  const headerBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const inputBg = isLight ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500' : 'bg-[#131b24] border-[#1e2a38] text-white placeholder-slate-500 focus:border-amber-500';
  const labelColor = isLight ? 'text-slate-700' : 'text-slate-300';
  const subTextColor = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const footerBg = isLight ? 'border-slate-200' : 'border-[#1e2a38]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className={`w-full max-w-lg border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ${modalBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${headerBg}`}>
          <div>
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              <span>{isEditing ? 'Edit Stop Details' : 'Log a Ride Stop'}</span>
            </h2>
            <p className={`text-xs mt-0.5 ${subTextColor}`}>
              Record where and why you stopped during the ride
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-[#1c2633]'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {/* Reason / Category Selection */}
          <div>
            <label className={`block text-xs font-bold mb-2 uppercase tracking-wide ${labelColor}`}>
              Why did you stop?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STOP_CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                const btnStyle = isLight
                  ? isSelected
                    ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-sm font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  : isSelected
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-sm font-semibold'
                    : 'bg-[#131b24] border-[#1e2a38] text-slate-400 hover:border-[#2a3a4d] hover:text-white';

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${btnStyle}`}
                  >
                    <span style={{ color: cat.color }}>{cat.icon}</span>
                    <span className="text-[11px] leading-tight">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stop Name / Place Title */}
          <div>
            <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${labelColor}`}>
              Stop Name or Location
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tapri Chai with friends, HP Petrol, Sunset Point"
              required
              className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none text-sm font-medium ${inputBg}`}
            />
          </div>

          {/* Duration in Minutes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-xs font-bold uppercase tracking-wide ${labelColor}`}>
                How long did you stop?
              </label>
              <span className="text-xs font-mono font-bold text-amber-500">
                {durationMinutes} minutes ({durationMinutes >= 60 ? `${Math.floor(durationMinutes/60)}h ${durationMinutes%60}m` : `${durationMinutes}m`})
              </span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                min="1"
                max="720"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                className={`w-24 px-3 py-2 border rounded-xl font-mono text-sm focus:outline-none ${inputBg}`}
              />
              <span className={subTextColor}>minutes</span>

              {/* Quick Pills */}
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                {[5, 15, 30, 45, 60].map((m) => {
                  const isSelected = durationMinutes === m;
                  const pillStyle = isLight
                    ? isSelected
                      ? 'bg-amber-100 border-amber-500 text-amber-800 font-bold'
                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                    : isSelected
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold'
                      : 'bg-[#131b24] border-[#1e2a38] text-slate-400 hover:text-white';

                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleQuickDuration(m)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer ${pillStyle}`}
                    >
                      {m}m
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Distance along ride */}
          <div>
            <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${labelColor}`}>
              Distance on Ride
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max={totalDistanceKm || 1000}
                value={distanceKm.toFixed(1)}
                onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)}
                className={`w-28 px-3 py-2 border rounded-xl font-mono text-sm focus:outline-none ${inputBg}`}
              />
              <span className={`font-mono text-xs ${subTextColor}`}>km from start (Total: {totalDistanceKm.toFixed(1)} km)</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide flex items-center gap-1.5 ${labelColor}`}>
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Notes / Remarks (Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Clean washroom available, Rs 40 chai, tyre pressure checked..."
              rows={2}
              className={`w-full px-3 py-2 border rounded-xl text-xs resize-none focus:outline-none ${inputBg}`}
            />
          </div>

          {/* Footer Actions */}
          <div className={`pt-3 border-t flex items-center justify-between gap-3 ${footerBg}`}>
            {isEditing ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove stop "${stopToEdit.name}"?`)) {
                    onDeleteStop(stopToEdit.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Stop</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 border rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-[#1c2633] hover:bg-[#253344] border-[#2a3a4d] text-slate-300 hover:text-white'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:shadow-amber-500/20"
              >
                <Save className="w-4 h-4" />
                <span>{isEditing ? 'Save Changes' : 'Add Stop'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
