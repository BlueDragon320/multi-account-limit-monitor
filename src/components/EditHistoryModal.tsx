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
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-history-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-window max-w-md p-6 bg-[#252422] border border-[#2e2c29] text-[#FBFAF9]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2e2c29]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#181818] border border-[#2e2c29] text-[#FF6542]">
              <History className="w-4 h-4" />
            </div>
            <h3 id="edit-history-modal-title" className="text-sm font-semibold text-[#FBFAF9]">
              Edit History Entry
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#898580] hover:text-[#FBFAF9] bg-transparent border-0 cursor-pointer p-1 rounded hover:bg-[#2e2c29]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          <div>
            <label className="label-text">Entry Type</label>
            <div className="p-2 bg-[#181818] border border-[#2e2c29] rounded text-[#898580] uppercase">
              {event.type === 'correction' ? 'Manual Balance Correction' : 'Project Usage Event'}
            </div>
          </div>

          <div>
            <label htmlFor="edit-ts" className="label-text">
              Event Timestamp
            </label>
            <input
              id="edit-ts"
              type="datetime-local"
              className="input-control text-xs"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="edit-note" className="label-text">
              Notes / Reason
            </label>
            <textarea
              id="edit-note"
              className="input-control min-h-[70px] text-xs resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2e2c29]">
            <button
              type="button"
              onClick={onClose}
              className="btn-dark-solid text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-cream text-xs font-semibold"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
