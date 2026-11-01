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
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-preview-title"
      onClick={onClose}
    >
      <div
        className="modal-window max-w-xl p-6 bg-[#252422] border border-[#2e2c29] text-[#FBFAF9]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2e2c29]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#181818] border border-[#FF6543] text-[#FF6542]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 id="import-preview-title" className="text-sm font-semibold text-[#FBFAF9]">
                Backup Import Preview
              </h3>
              <p className="text-[11px] text-[#898580] font-mono">
                Inspect incoming data structure before replacing existing records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#898580] hover:text-[#FBFAF9] bg-transparent border-0 cursor-pointer p-1 rounded hover:bg-[#2e2c29]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 font-mono text-xs">
          {/* Validity Status */}
          {!valid ? (
            <div className="p-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-lg text-[#ef4444] space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Import Validation Failed</span>
              </div>
              <p className="text-[11px] pl-6">{error || 'Invalid backup structure or unrecognized JSON format.'}</p>
            </div>
          ) : (
            <div className="p-3 bg-[#181818] border border-[#2e2c29] rounded-lg space-y-1.5">
              <div className="flex items-center gap-2 text-[#10b981] font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Schema Valid</span>
              </div>
              <p className="text-[11px] text-[#898580]">
                {summary
                  ? `Incoming payload contains ${summary.accountsCount} accounts, ${summary.servicesCount} services, ${summary.windowsCount} windows, and ${summary.eventsCount} events.`
                  : 'Valid Quota Ember JSON backup file'}
              </p>
            </div>
          )}

          {/* Replacement Warning Notice */}
          {valid && (
            <div className="p-3 bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] rounded-lg text-[#f59e0b] flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold">Destructive Action:</span> Importing will completely replace all current accounts, limit windows, projects, and history in this browser. Export a backup of your current state first if needed.
              </div>
            </div>
          )}

          {/* Diff Metrics Table */}
          {importDiff && valid && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-[#898580] font-semibold">
                State Comparison Summary
              </div>
              <div className="bg-[#181818] border border-[#2e2c29] rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[#201f1d] text-[#898580] border-b border-[#2e2c29]">
                    <tr>
                      <th className="py-2 px-3 font-medium">Record Type</th>
                      <th className="py-2 px-3 font-medium text-right">Current</th>
                      <th className="py-2 px-3 font-medium text-center"></th>
                      <th className="py-2 px-3 font-medium text-right">Incoming</th>
                      <th className="py-2 px-3 font-medium text-right">Net Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2c29]">
                    {diffRows.map((row) => (
                      <tr key={row.label} className="hover:bg-[#201f1d]">
                        <td className="py-2 px-3 text-[#FBFAF9]">{row.label}</td>
                        <td className="py-2 px-3 text-right text-[#898580]">{row.metric.current}</td>
                        <td className="py-2 px-1 text-center text-[#66635f]">
                          <ArrowRight className="w-3 h-3 inline" />
                        </td>
                        <td className="py-2 px-3 text-right text-[#FBFAF9] font-medium">
                          {row.metric.incoming}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-medium ${
                            row.metric.delta > 0
                              ? 'text-[#10b981]'
                              : row.metric.delta < 0
                              ? 'text-[#ef4444]'
                              : 'text-[#898580]'
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
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2e2c29]">
            <button
              type="button"
              onClick={onClose}
              className="btn-dark-solid text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!valid || !parsedState}
              className="btn-danger text-xs font-semibold"
            >
              Replace All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
