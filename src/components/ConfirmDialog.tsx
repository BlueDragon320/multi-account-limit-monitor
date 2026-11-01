import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[#0C0A09]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="bg-[#1C1917] border border-[rgba(255,255,255,0.12)] rounded-[24px] p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] text-[#E7E5E4]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-full shrink-0 ${
                isDestructive
                  ? 'bg-[rgba(248,113,113,0.15)] text-[#f87171] border border-[rgba(248,113,113,0.3)]'
                  : 'bg-[rgba(212,242,104,0.15)] text-[#D4F268] border border-[rgba(212,242,104,0.3)]'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 id="confirm-dialog-title" className="font-serif font-light text-2xl text-[#E7E5E4] tracking-tight">
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-full text-[#A8A29E] hover:text-[#E7E5E4] hover:bg-[#292524] transition-all cursor-pointer border-0 bg-transparent shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 bg-[#141210] rounded-xl border border-[rgba(255,255,255,0.08)] mb-6 text-xs text-[#A8A29E] font-mono leading-relaxed whitespace-pre-wrap">
          {message}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(255,255,255,0.1)]">
          <button
            type="button"
            onClick={onCancel}
            className="btn-dark-solid bg-[#292524] text-[#E7E5E4] px-4 py-2 rounded-full text-sm border border-[rgba(255,255,255,0.1)] hover:bg-[#383431] transition-all font-sans cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              isDestructive
                ? 'btn-danger bg-[rgba(248,113,113,0.15)] text-[#f87171] border border-[rgba(248,113,113,0.3)] px-5 py-2 rounded-full text-sm hover:bg-[rgba(248,113,113,0.25)] transition-all font-sans font-semibold cursor-pointer'
                : 'btn-primary-lime bg-[#D4F268] text-[#0C0A09] font-semibold px-5 py-2 rounded-full text-sm hover:bg-[#c4e450] transition-all shadow-[0_0_12px_rgba(212,242,104,0.2)] font-sans cursor-pointer'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
