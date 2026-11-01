import React, { useState, useEffect } from 'react';
import { X, History } from 'lucide-react';
import { UsageEvent } from '../domain/types';
import { toLocalDatetimeInputValue } from '../utils/formatters';

interface EditHistoryModalProps {
  isOpen: boolean;
  event: UsageEvent | null;
  onSave: (eventId: string, updates: { timestamp?: string; note?: string }) => void;
  onClose: () => void;
}

export const EditHistoryModal: React.FC<EditHistoryModalProps> = ({
  isOpen,
  event,
  onSave,
  onClose,
}) => {
  const [timestamp, setTimestamp] = useState(() =>
    event ? toLocalDatetimeInputValue(new Date(event.timestamp)) : ''
  );
  const [note, setNote] = useState(() => (event ? event.note || '' : ''));

  useEffect(() => {
    if (isOpen && event) {
      setTimestamp(toLocalDatetimeInputValue(new Date(event.timestamp)));
      setNote(event.note || '');
    }
  }, [isOpen, event]);

  if (!isOpen || !event) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(event.id, {
      timestamp: new Date(timestamp).toISOString(),
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-[#0C0A09]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-history-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1917] border border-[rgba(255,255,255,0.12)] rounded-[24px] p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] text-[#E7E5E4]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 mb-6 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[#D4F268]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 id="edit-history-modal-title" className="font-serif font-light text-2xl text-[#E7E5E4] tracking-tight">
                Edit History Entry
              </h2>
              <p className="text-xs text-[#A8A29E] font-sans mt-0.5">
                Revise audit note or backdate timeline timestamp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#A8A29E] hover:text-[#E7E5E4] hover:bg-[#292524] transition-all cursor-pointer border-0 bg-transparent shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 font-sans">
          <div>
            <label className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Entry Type
            </label>
            <div className="p-3 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs font-mono text-[#D4F268]">
              {event.type === 'correction' ? 'Manual Balance Correction' : 'Project Usage Event'}
            </div>
          </div>

          <div>
            <label htmlFor="edit-ts" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Event Timestamp
            </label>
            <input
              id="edit-ts"
              type="datetime-local"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="edit-note" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Notes / Reason
            </label>
            <textarea
              id="edit-note"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all min-h-[85px] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(255,255,255,0.1)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-dark-solid bg-[#292524] text-[#E7E5E4] px-4 py-2 rounded-full text-sm border border-[rgba(255,255,255,0.1)] hover:bg-[#383431] transition-all font-sans cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-lime bg-[#D4F268] text-[#0C0A09] font-semibold px-5 py-2 rounded-full text-sm hover:bg-[#c4e450] transition-all shadow-[0_0_12px_rgba(212,242,104,0.2)] font-sans cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
