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
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="correct-balance-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-window max-w-lg p-6 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] text-[#E7E5E4]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#141210] border border-[#f59e0b] text-[#f59e0b]">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 id="correct-balance-modal-title" className="text-sm font-semibold text-[#E7E5E4]">
                Manual Balance Correction
              </h3>
              <p className="text-[11px] text-[#A8A29E] font-mono">
                Calibrates tracker to external provider console reality with an audit trail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#A8A29E] hover:text-[#E7E5E4] bg-transparent border-0 cursor-pointer p-1 rounded hover:bg-[rgba(255,255,255,0.1)]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Window Selector */}
          <div>
            <label htmlFor="corr-window" className="label-text">
              Limit Window <span className="text-[#D4F268]">*</span>
            </label>
            <select
              id="corr-window"
              className="input-control text-xs"
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
              <label className="label-text">Current Recorded Used</label>
              <div className="input-control bg-[#141210] border-[rgba(255,255,255,0.1)] text-[#A8A29E] cursor-not-allowed text-xs py-2">
                {selectedWindow ? `${formatNumber(selectedWindow.currentUsed)} ${unit}` : '—'}
              </div>
            </div>

            <div>
              <label htmlFor="corr-new-value" className="label-text">
                Observed Used Value <span className="text-[#D4F268]">*</span>
              </label>
              <input
                id="corr-new-value"
                type="number"
                min="0"
                step="any"
                className="input-control text-xs"
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
            <label htmlFor="corr-time" className="label-text">
              Observation Timestamp
            </label>
            <input
              id="corr-time"
              type="datetime-local"
              className="input-control text-xs"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              required
            />
          </div>

          {/* Mandatory Correction Reason */}
          <div>
            <label htmlFor="corr-reason" className="label-text flex items-center justify-between">
              <span>Correction Reason (Mandatory Audit Trail) <span className="text-[#D4F268]">*</span></span>
              <span className="text-[10px] text-[#A8A29E] normal-case">Preserves history</span>
            </label>
            <textarea
              id="corr-reason"
              className="input-control min-h-[70px] text-xs resize-y"
              placeholder="e.g., Aligned with Google Cloud Console dashboard after unexpected batch job; reset discrepancy reconciliation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          {/* Comparison Preview Box */}
          {selectedWindow && !isNaN(parsedNewValue) && (
            <div className="p-3 bg-[#141210] border border-[rgba(255,255,255,0.1)] rounded-lg space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-[#A8A29E] border-b border-[rgba(255,255,255,0.1)] pb-1.5">
                <span className="text-[11px] uppercase tracking-wider text-[#f59e0b] font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Audit Trail Preview
                </span>
                <span>
                  Delta:{' '}
                  <span
                    className={
                      delta > 0 ? 'text-[#ef4444]' : delta < 0 ? 'text-[#10b981]' : 'text-[#A8A29E]'
                    }
                  >
                    {delta > 0 ? `+${formatNumber(delta)}` : formatNumber(delta)} {unit}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A8A29E]">Balance Adjustment:</span>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="text-[#A8A29E] line-through">{formatNumber(currentUsed)}</span>
                  <ArrowRight className="w-3 h-3 text-[#f59e0b]" />
                  <span className="text-[#E7E5E4] font-semibold">{formatNumber(parsedNewValue)} {unit}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A8A29E]">New Remaining:</span>
                <span className={newRemaining <= 0 ? 'text-[#ef4444] font-semibold' : 'text-[#10b981] font-semibold'}>
                  {formatNumber(newRemaining)} {unit} ({Math.max(0, Math.round(100 - newPercent))}% remaining)
                </span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(255,255,255,0.1)]">
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
              Record Correction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
