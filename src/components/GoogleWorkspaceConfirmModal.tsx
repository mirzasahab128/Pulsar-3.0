import React from 'react';
import { AlertTriangle, Trash2, CheckCircle2, X, RefreshCw } from 'lucide-react';

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmButtonText: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const GoogleWorkspaceConfirmModal: React.FC<ConfirmDialogState> = ({
  isOpen,
  title,
  description,
  details,
  confirmButtonText,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  isLoading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl glass-modal relative overflow-hidden transition-all transform scale-100 bg-slate-900/95 border-rose-500/30 text-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Glow corner */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 rounded-full bg-rose-500/10 blur-2xl pointer-events-none" />

        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl shrink-0 ${
            confirmVariant === 'danger'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : confirmVariant === 'warning'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
          }`}>
            {confirmVariant === 'danger' ? (
              <Trash2 className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-lg font-bold tracking-tight text-white">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              {description}
            </p>

            {details && details.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-black/40 border border-white/5 max-h-36 overflow-y-auto space-y-1">
                {details.map((item, idx) => (
                  <div key={idx} className="text-xs text-slate-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Explicit user confirmation required for Google Workspace data changes.</span>
            </div>
          </div>

          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition cursor-pointer disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                : confirmVariant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                : 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/30'
            }`}
          >
            {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
