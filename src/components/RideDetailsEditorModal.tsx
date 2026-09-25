import React, { useState } from 'react';
import { X, Save, Edit3 } from 'lucide-react';
import { AppTheme } from '../types';

interface RideDetailsEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSaveName: (newName: string) => void;
  theme?: AppTheme;
}

export const RideDetailsEditorModal: React.FC<RideDetailsEditorModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onSaveName,
  theme = 'dark',
}) => {
  if (!isOpen) return null;

  const isLight = theme === 'light';
  const [name, setName] = useState(currentName);

  React.useEffect(() => {
    if (isOpen) {
      setName(currentName);
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSaveName(name.trim());
      onClose();
    }
  };

  const modalBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/80';
  const headerBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const inputBg = isLight ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500' : 'bg-[#131b24] border-[#1e2a38] text-white placeholder-slate-500 focus:border-amber-500';
  const labelColor = isLight ? 'text-slate-700' : 'text-slate-300';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className={`w-full max-w-md border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90dvh] overscroll-contain ${modalBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${headerBg}`}>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-500" />
            <span>Edit Ride Name</span>
          </h2>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-[#1c2633]'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div>
            <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${labelColor}`}>
              Ride Title
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunday Morning Breakfast Ride to Lonavala"
              required
              className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-medium focus:outline-none ${inputBg}`}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
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
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Name</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
