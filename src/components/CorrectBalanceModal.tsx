import React, { useState, useEffect, useMemo } from 'react';
import { X, RotateCcw, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { LimitWindow, Account, Service, RecordCorrectionInput } from '../domain/types';
import { formatNumber, toLocalDatetimeInputValue } from '../utils/formatters';

interface CorrectBalanceModalProps {
  isOpen: boolean;
  limitWindows: LimitWindow[];
  accounts: Account[];
  services: Service[];
  preselectedWindowId?: string;
  onSave: (input: RecordCorrectionInput) => void;
  onClose: () => void;
}

export const CorrectBalanceModal: React.FC<CorrectBalanceModalProps> = ({
  isOpen,
  limitWindows,
  accounts,
  services,
  preselectedWindowId,
  onSave,
  onClose,
}) => {
  const initialWin = useMemo(() => {
    if (preselectedWindowId) {
      return limitWindows.find((w) => w.id === preselectedWindowId);
    }
    return limitWindows.find((w) => !w.archived);
  }, [preselectedWindowId, limitWindows]);

  const [windowId, setWindowId] = useState<string>(() => (initialWin ? initialWin.id : ''));
  const [newUsedValue, setNewUsedValue] = useState<string>(() =>
    initialWin ? initialWin.currentUsed.toString() : '0'
  );
  const [reason, setReason] = useState<string>('');
  const [timestamp, setTimestamp] = useState<string>(toLocalDatetimeInputValue());
  const [error, setError] = useState<string | null>(null);

  // Active limit windows
  const activeWindows = useMemo(() => limitWindows.filter((w) => !w.archived), [limitWindows]);

  useEffect(() => {
    if (!isOpen) return;

    setTimestamp(toLocalDatetimeInputValue());
    setError(null);
    setReason('');

    const targetId = preselectedWindowId || (activeWindows.length > 0 ? activeWindows[0].id : '');
    setWindowId(targetId);

    const win = limitWindows.find((w) => w.id === targetId);
    if (win) {
      setNewUsedValue(win.currentUsed.toString());
    }
  }, [isOpen, preselectedWindowId, activeWindows, limitWindows]);

  const selectedWindow = useMemo(() => {
    return limitWindows.find((w) => w.id === windowId);
  }, [limitWindows, windowId]);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const handleWindowChange = (id: string) => {
    setWindowId(id);
    const win = limitWindows.find((w) => w.id === id);
    if (win) {
      setNewUsedValue(win.currentUsed.toString());
    }
  };

  const parsedNewValue = parseFloat(newUsedValue);
  const currentUsed = selectedWindow ? selectedWindow.currentUsed : 0;
  const capacity = selectedWindow ? selectedWindow.capacity : 100;
  const unit = selectedWindow
    ? selectedWindow.unit === 'custom'
      ? selectedWindow.customUnitName || 'custom'
      : selectedWindow.unit
    : '';

  const delta = !isNaN(parsedNewValue) ? parsedNewValue - currentUsed : 0;
  const newRemaining = Math.max(0, capacity - (!isNaN(parsedNewValue) ? parsedNewValue : 0));
  const newPercent = capacity > 0 && !isNaN(parsedNewValue) ? (parsedNewValue / capacity) * 100 : 0;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!windowId) {
      setError('Please select a limit window to correct.');
      return;
    }
    if (isNaN(parsedNewValue) || parsedNewValue < 0) {
      setError('Please enter a valid non-negative number for the observed balance.');
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('A correction reason is required for audit trail compliance.');
      return;
    }

    onSave({
      windowId,
      newUsed: parsedNewValue,
      reason: trimmedReason,
      timestamp: new Date(timestamp).toISOString(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-[#0C0A09]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="correct-balance-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1917] border border-[rgba(255,255,255,0.12)] rounded-[24px] p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] text-[#E7E5E4]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 mb-6 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[#fbbf24]">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 id="correct-balance-modal-title" className="font-serif font-light text-2xl text-[#E7E5E4] tracking-tight">
                Manual Balance Correction
              </h2>
              <p className="text-xs text-[#A8A29E] font-sans mt-0.5">
                Calibrates tracker to external provider console reality with an audit trail
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.3)] text-[#f87171] text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Window Selector */}
          <div>
            <label htmlFor="corr-window" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Limit Window <span className="text-[#D4F268]">*</span>
            </label>
            <select
              id="corr-window"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
              value={windowId}
              onChange={(e) => handleWindowChange(e.target.value)}
              required
            >
              {activeWindows.length === 0 ? (
                <option value="">No limit windows available</option>
              ) : (
                activeWindows.map((w) => {
                  const acc = accountMap.get(w.accountId);
                  const svc = serviceMap.get(w.serviceId);
                  const u = w.unit === 'custom' ? w.customUnitName || 'custom' : w.unit;
                  return (
                    <option key={w.id} value={w.id}>
                      {acc ? `${acc.name} > ` : ''}
                      {svc ? `${svc.name} > ` : ''}
                      {w.name} ({w.cadence}, cap {formatNumber(w.capacity)} {u})
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* Current vs New Input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Current Recorded Used
              </label>
              <div className="w-full bg-[#141210] border border-[rgba(255,255,255,0.08)] text-[#A8A29E] rounded-xl px-3.5 py-2.5 text-sm font-mono cursor-not-allowed">
                {selectedWindow ? `${formatNumber(selectedWindow.currentUsed)} ${unit}` : '—'}
              </div>
            </div>

            <div>
              <label htmlFor="corr-new-value" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Observed Used Value <span className="text-[#D4F268]">*</span>
              </label>
              <input
                id="corr-new-value"
                type="number"
                min="0"
                step="any"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                value={newUsedValue}
                onChange={(e) => setNewUsedValue(e.target.value)}
                placeholder="Observed in console..."
                required
                autoFocus
              />
            </div>
          </div>

          {/* Timestamp */}
          <div>
            <label htmlFor="corr-time" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Observation Timestamp
            </label>
            <input
              id="corr-time"
              type="datetime-local"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              required
            />
          </div>

          {/* Mandatory Correction Reason */}
          <div>
            <label htmlFor="corr-reason" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider flex items-center justify-between mb-1.5">
              <span>Correction Reason (Mandatory Audit Trail) <span className="text-[#D4F268]">*</span></span>
              <span className="text-[11px] text-[#A8A29E] normal-case font-mono">Preserves history</span>
            </label>
            <textarea
              id="corr-reason"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all min-h-[85px] resize-y"
              placeholder="e.g., Aligned with Google Cloud Console dashboard after unexpected batch job; reset discrepancy reconciliation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          {/* Audit Trail Preview Box */}
          {selectedWindow && !isNaN(parsedNewValue) && (
            <div className="p-4 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-xl space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between text-[#A8A29E] border-b border-[rgba(255,255,255,0.08)] pb-2">
                <span className="text-xs uppercase tracking-wider text-[#fbbf24] font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#fbbf24]" />
                  Audit Trail Preview
                </span>
                <span>
                  Delta:{' '}
                  <span
                    className={
                      delta > 0 ? 'text-[#f87171] font-semibold' : delta < 0 ? 'text-[#10b981] font-semibold' : 'text-[#A8A29E]'
                    }
                  >
                    {delta > 0 ? `+${formatNumber(delta)}` : formatNumber(delta)} {unit}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A8A29E]">Balance Adjustment:</span>
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-[#A8A29E] line-through">{formatNumber(currentUsed)}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#fbbf24]" />
                  <span className="text-[#E7E5E4] font-semibold">{formatNumber(parsedNewValue)} {unit}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A8A29E]">New Remaining:</span>
                <span className={newRemaining <= 0 ? 'text-[#f87171] font-semibold' : 'text-[#10b981] font-semibold'}>
                  {formatNumber(newRemaining)} {unit} ({Math.max(0, Math.round(100 - newPercent))}% remaining)
                </span>
              </div>

              {reason.trim() && (
                <div className="pt-1.5 border-t border-[rgba(255,255,255,0.06)] text-[11px] text-[#A8A29E] flex items-start gap-1.5">
                  <span className="text-[#78716C] uppercase font-semibold">Note:</span>
                  <span className="italic truncate text-[#E7E5E4]">{reason.trim()}</span>
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
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
              Record Correction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
