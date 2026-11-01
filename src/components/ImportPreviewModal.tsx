import React from 'react';
import { X, AlertTriangle, ArrowRight, Database, CheckCircle2, ShieldAlert } from 'lucide-react';
import { AppState } from '../domain/types';
import { ValidationResult, ImportDiff } from '../storage/exportImport';

interface ImportPreviewModalProps {
  isOpen: boolean;
  validationResult: ValidationResult | null;
  importDiff: ImportDiff | null;
  onConfirmReplace: (incomingState: AppState) => void;
  onClose: () => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  isOpen,
  validationResult,
  importDiff,
  onConfirmReplace,
  onClose,
}) => {
  if (!isOpen || !validationResult) return null;

  const { valid, error, state: parsedState, summary } = validationResult;

  const handleConfirm = () => {
    if (valid && parsedState) {
      onConfirmReplace(parsedState);
      onClose();
    }
  };

  const diffRows = importDiff
    ? [
        { label: 'Accounts', metric: importDiff.accounts },
        { label: 'Services', metric: importDiff.services },
        { label: 'Limit Windows', metric: importDiff.windows },
        { label: 'Projects', metric: importDiff.projects },
        { label: 'Usage Events', metric: importDiff.events },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 bg-[#0C0A09]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-preview-title"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1917] border border-[rgba(255,255,255,0.12)] rounded-[24px] p-6 sm:p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] text-[#E7E5E4]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 mb-6 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[#D4F268]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 id="import-preview-title" className="font-serif font-light text-2xl text-[#E7E5E4] tracking-tight">
                Backup Import Preview
              </h2>
              <p className="text-xs text-[#A8A29E] font-sans mt-0.5">
                Inspect incoming data structure before replacing existing records
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

        <div className="space-y-5 font-mono text-xs">
          {/* Validity Status */}
          {!valid ? (
            <div className="p-4 bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.3)] rounded-2xl text-[#f87171] space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Import Validation Failed</span>
              </div>
              <p className="text-[11px] pl-6 text-[#A8A29E]">{error || 'Invalid backup structure or unrecognized JSON format.'}</p>
            </div>
          ) : (
            <div className="p-4 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-[#D4F268] font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 text-[#D4F268]" />
                <span>Schema Valid</span>
              </div>
              <p className="text-[11px] text-[#A8A29E] pl-6">
                {summary
                  ? `Incoming payload contains ${summary.accountsCount} accounts, ${summary.servicesCount} services, ${summary.windowsCount} windows, and ${summary.eventsCount} events.`
                  : 'Valid Quota Ember JSON backup file'}
              </p>
            </div>
          )}

          {/* Replacement Warning Notice */}
          {valid && (
            <div className="p-4 bg-[rgba(251,191,36,0.1)] border border-[rgba(251,191,36,0.3)] rounded-2xl text-[#fbbf24] flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-[#fbbf24]" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold text-white">Destructive Action:</span> Importing will completely replace all current accounts, limit windows, projects, and history in this browser. Export a backup of your current state first if needed.
              </div>
            </div>
          )}

          {/* Diff Metrics Table */}
          {importDiff && valid && (
            <div className="space-y-2.5">
              <div className="text-xs uppercase tracking-wider text-[#A8A29E] font-semibold font-sans">
                State Comparison Summary
              </div>
              <div className="bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1C1917] text-[#A8A29E] border-b border-[rgba(255,255,255,0.08)]">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Record Type</th>
                      <th className="py-2.5 px-4 font-medium text-right">Current</th>
                      <th className="py-2.5 px-2 font-medium text-center"></th>
                      <th className="py-2.5 px-4 font-medium text-right">Incoming</th>
                      <th className="py-2.5 px-4 font-medium text-right">Net Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
                    {diffRows.map((row) => (
                      <tr key={row.label} className="hover:bg-[#1C1917]/70 transition-colors">
                        <td className="py-2.5 px-4 text-[#E7E5E4] font-medium">{row.label}</td>
                        <td className="py-2.5 px-4 text-right text-[#A8A29E]">{row.metric.current}</td>
                        <td className="py-2.5 px-2 text-center text-[#78716C]">
                          <ArrowRight className="w-3.5 h-3.5 inline text-[#78716C]" />
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#E7E5E4] font-medium">
                          {row.metric.incoming}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-medium ${
                            row.metric.delta > 0
                              ? 'text-[#D4F268]'
                              : row.metric.delta < 0
                              ? 'text-[#f87171]'
                              : 'text-[#A8A29E]'
                          }`}
                        >
                          {row.metric.delta > 0 ? `+${row.metric.delta}` : row.metric.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              type="button"
              onClick={handleConfirm}
              disabled={!valid || !parsedState}
              className="btn-danger bg-[rgba(248,113,113,0.15)] text-[#f87171] border border-[rgba(248,113,113,0.3)] px-5 py-2 rounded-full text-sm hover:bg-[rgba(248,113,113,0.25)] transition-all font-sans font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Replace All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
