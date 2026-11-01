import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, AlertCircle, Check, ArrowRight, Layers } from 'lucide-react';
import { Account, Service, LimitWindow, Project, ApplyUsageEventInput } from '../domain/types';
import { previewUsageEvent } from '../domain/calculations';
import { toLocalDatetimeInputValue, formatNumber } from '../utils/formatters';

interface LogUsageModalProps {
  isOpen: boolean;
  accounts: Account[];
  services: Service[];
  limitWindows: LimitWindow[];
  projects: Project[];
  preselectedWindowId?: string;
  onSave: (input: ApplyUsageEventInput) => void;
  onQuickAddProject?: (name: string) => Project;
  onClose: () => void;
}

export const LogUsageModal: React.FC<LogUsageModalProps> = ({
  isOpen,
  accounts,
  services,
  limitWindows,
  projects,
  preselectedWindowId,
  onSave,
  onQuickAddProject,
  onClose,
}) => {
  const initialTargetWin = useMemo(() => {
    if (preselectedWindowId) {
      return limitWindows.find((w) => w.id === preselectedWindowId);
    }
    return undefined;
  }, [preselectedWindowId, limitWindows]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (initialTargetWin) return initialTargetWin.accountId;
    const firstAcc = accounts.find((a) => !a.archived);
    return firstAcc ? firstAcc.id : '';
  });

  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    if (initialTargetWin) return initialTargetWin.serviceId;
    const firstAcc = accounts.find((a) => !a.archived);
    if (!firstAcc) return '';
    const accServices = services.filter((s) => s.accountId === firstAcc.id && !s.archived);
    return accServices.length > 0 ? accServices[0].id : '';
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    const firstProj = projects.find((p) => !p.archived);
    return firstProj ? firstProj.id : '';
  });

  const [selectedWindowIds, setSelectedWindowIds] = useState<string[]>(() => {
    if (initialTargetWin) return [initialTargetWin.id];
    const firstAcc = accounts.find((a) => !a.archived);
    if (!firstAcc) return [];
    const accServices = services.filter((s) => s.accountId === firstAcc.id && !s.archived);
    if (accServices.length === 0) return [];
    const wins = limitWindows.filter((w) => w.serviceId === accServices[0].id && !w.archived);
    return wins.map((w) => w.id);
  });
  const [amount, setAmount] = useState<string>('1');
  const [isPercentage, setIsPercentage] = useState<boolean>(false);
  const [timestamp, setTimestamp] = useState<string>(toLocalDatetimeInputValue());
  const [note, setNote] = useState<string>('');
  
  // Quick-add project inline state
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Active items filter
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  // Initialize or update when opening
  useEffect(() => {
    if (!isOpen) return;

    setTimestamp(toLocalDatetimeInputValue());
    setError(null);
    setIsAddingProject(false);
    setNewProjectName('');

    if (preselectedWindowId) {
      const targetWin = limitWindows.find((w) => w.id === preselectedWindowId);
      if (targetWin) {
        setSelectedAccountId(targetWin.accountId);
        setSelectedServiceId(targetWin.serviceId);
        setSelectedWindowIds([targetWin.id]);
        return;
      }
    }

    // Default to first active account
    if (activeAccounts.length > 0 && !selectedAccountId) {
      const firstAcc = activeAccounts[0];
      setSelectedAccountId(firstAcc.id);
      const accServices = services.filter((s) => s.accountId === firstAcc.id && !s.archived);
      if (accServices.length > 0) {
        setSelectedServiceId(accServices[0].id);
        const win = limitWindows.filter((w) => w.serviceId === accServices[0].id && !w.archived);
        setSelectedWindowIds(win.length > 0 ? [win[0].id] : []);
      }
    }

    // Default project
    if (activeProjects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(activeProjects[0].id);
    }
  }, [isOpen, preselectedWindowId, activeAccounts, activeProjects, limitWindows, services]);

  // Available services for currently selected account
  const availableServices = useMemo(() => {
    if (!selectedAccountId) return [];
    return services.filter((s) => s.accountId === selectedAccountId && !s.archived);
  }, [services, selectedAccountId]);

  // Available windows for currently selected service
  const availableWindows = useMemo(() => {
    if (!selectedServiceId) return [];
    return limitWindows.filter((w) => w.serviceId === selectedServiceId && !w.archived);
  }, [limitWindows, selectedServiceId]);

  // Handle Account change
  const handleAccountChange = (accId: string) => {
    setSelectedAccountId(accId);
    const accServices = services.filter((s) => s.accountId === accId && !s.archived);
    if (accServices.length > 0) {
      setSelectedServiceId(accServices[0].id);
      const wins = limitWindows.filter((w) => w.serviceId === accServices[0].id && !w.archived);
      setSelectedWindowIds(wins.map((w) => w.id)); // select all windows by default for convenient multi-window tracking
    } else {
      setSelectedServiceId('');
      setSelectedWindowIds([]);
    }
  };

  // Handle Service change
  const handleServiceChange = (svcId: string) => {
    setSelectedServiceId(svcId);
    const wins = limitWindows.filter((w) => w.serviceId === svcId && !w.archived);
    setSelectedWindowIds(wins.map((w) => w.id));
  };

  // Toggle a window checkbox
  const toggleWindowSelection = (winId: string) => {
    setSelectedWindowIds((prev) =>
      prev.includes(winId) ? prev.filter((id) => id !== winId) : [...prev, winId]
    );
  };

  // Select all / Deselect all
  const selectAllServiceWindows = () => {
    setSelectedWindowIds(availableWindows.map((w) => w.id));
  };

  // Quick add project inline
  const handleCreateProjectInline = () => {
    const trimmed = newProjectName.trim();
    if (!trimmed) return;
    if (onQuickAddProject) {
      const created = onQuickAddProject(trimmed);
      setSelectedProjectId(created.id);
      setIsAddingProject(false);
      setNewProjectName('');
    }
  };

  // Live balance preview calculations
  const parsedAmount = parseFloat(amount) || 0;
  const livePreviews = useMemo(() => {
    if (parsedAmount <= 0) return [];
    return selectedWindowIds
      .map((id) => {
        const win = limitWindows.find((w) => w.id === id);
        if (!win) return null;
        try {
          return {
            window: win,
            preview: previewUsageEvent(win, parsedAmount, isPercentage),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<{
        window: LimitWindow;
        preview: ReturnType<typeof previewUsageEvent>;
      }>;
  }, [selectedWindowIds, limitWindows, parsedAmount, isPercentage]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      setError('Please select an account.');
      return;
    }
    if (!selectedServiceId) {
      setError('Please select a service.');
      return;
    }
    if (!selectedProjectId) {
      setError('Please select or create a project.');
      return;
    }
    if (selectedWindowIds.length === 0) {
      setError('Please select at least one limit window to apply usage to.');
      return;
    }
    if (parsedAmount <= 0 || isNaN(parsedAmount)) {
      setError('Please enter a usage amount greater than zero.');
      return;
    }

    onSave({
      accountId: selectedAccountId,
      serviceId: selectedServiceId,
      projectId: selectedProjectId,
      timestamp: new Date(timestamp).toISOString(),
      note: note.trim() || undefined,
      amount: parsedAmount,
      isPercentage,
      windowIds: selectedWindowIds,
    });
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-usage-modal-title"
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
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 id="log-usage-modal-title" className="text-sm font-semibold text-[#FBFAF9]">
                Log Usage Event
              </h3>
              <p className="text-[11px] text-[#898580] font-mono">
                Multi-window effects are tracked without double-counting
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Account and Service Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="log-account" className="label-text">
                Account <span className="text-[#FF6542]">*</span>
              </label>
              <select
                id="log-account"
                className="input-control text-xs"
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                required
              >
                {activeAccounts.length === 0 ? (
                  <option value="">No active accounts</option>
                ) : (
                  activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label htmlFor="log-service" className="label-text">
                Service <span className="text-[#FF6542]">*</span>
              </label>
              <select
                id="log-service"
                className="input-control text-xs"
                value={selectedServiceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                required
                disabled={availableServices.length === 0}
              >
                {availableServices.length === 0 ? (
                  <option value="">No active services for account</option>
                ) : (
                  availableServices.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Project Selector with Inline Quick Add */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="log-project" className="label-text mb-0">
                Project <span className="text-[#FF6542]">*</span>
              </label>
              {onQuickAddProject && !isAddingProject && (
                <button
                  type="button"
                  onClick={() => setIsAddingProject(true)}
                  className="text-[10px] text-[#FF6542] hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Quick Add Project</span>
                </button>
              )}
            </div>

            {isAddingProject ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="New project name..."
                  className="input-control text-xs flex-1"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateProjectInline}
                  className="btn-primary-cream text-xs h-8 px-3"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingProject(false);
                    setNewProjectName('');
                  }}
                  className="btn-dark-solid text-xs h-8 px-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                id="log-project"
                className="input-control text-xs"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
              >
                {activeProjects.length === 0 ? (
                  <option value="">No projects available (Create one)</option>
                ) : (
                  activeProjects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Affected Limit Windows Checkbox List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label-text mb-0">
                Affected Windows in this Service <span className="text-[#FF6542]">*</span>
              </label>
              {availableWindows.length > 1 && (
                <button
                  type="button"
                  onClick={selectAllServiceWindows}
                  className="text-[10px] text-[#898580] hover:text-[#FBFAF9] bg-transparent border-0 cursor-pointer underline"
                >
                  Select all ({availableWindows.length})
                </button>
              )}
            </div>

            {availableWindows.length === 0 ? (
              <div className="p-3 bg-[#181818] border border-[#2e2c29] rounded text-center text-xs text-[#898580]">
                No limit windows configured for this service.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableWindows.map((win) => {
                  const isChecked = selectedWindowIds.includes(win.id);
                  const unitDisplay = win.unit === 'custom' ? win.customUnitName || 'custom' : win.unit;
                  return (
                    <div
                      key={win.id}
                      onClick={() => toggleWindowSelection(win.id)}
                      className={`p-2.5 rounded border cursor-pointer flex items-center justify-between transition-all ${
                        isChecked
                          ? 'bg-[#181818] border-[#FF6542] text-[#FBFAF9]'
                          : 'bg-[#1c1b19] border-[#2e2c29] text-[#898580] hover:border-[#45433f]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isChecked
                              ? 'bg-[#FF6542] border-[#FF6542] text-white'
                              : 'border-[#45433f] bg-[#030302]'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="truncate">
                          <div className="font-medium text-xs truncate">{win.name}</div>
                          <div className="text-[10px] text-[#898580] font-mono">
                            {win.cadence} • cap {formatNumber(win.capacity)} {unitDisplay}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Amount and Unit Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="log-amount" className="label-text">
                Amount Used <span className="text-[#FF6542]">*</span>
              </label>
              <input
                id="log-amount"
                type="number"
                min="0.001"
                step="any"
                className="input-control text-xs"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 25"
                required
              />
            </div>

            <div>
              <label className="label-text">Amount Format</label>
              <div className="grid grid-cols-2 gap-1 bg-[#181818] p-1 rounded-md border border-[#2e2c29]">
                <button
                  type="button"
                  onClick={() => setIsPercentage(false)}
                  className={`py-1 text-xs font-mono rounded transition-colors border-0 cursor-pointer ${
                    !isPercentage
                      ? 'bg-[#252422] text-[#FBFAF9] font-medium'
                      : 'bg-transparent text-[#898580] hover:text-[#FBFAF9]'
                  }`}
                >
                  Numeric Units
                </button>
                <button
                  type="button"
                  onClick={() => setIsPercentage(true)}
                  className={`py-1 text-xs font-mono rounded transition-colors border-0 cursor-pointer ${
                    isPercentage
                      ? 'bg-[#252422] text-[#FBFAF9] font-medium'
                      : 'bg-transparent text-[#898580] hover:text-[#FBFAF9]'
                  }`}
                >
                  % of Capacity
                </button>
              </div>
            </div>
          </div>

          {/* Date & Time Picker + Optional Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="log-timestamp" className="label-text">
                Event Date & Time
              </label>
              <input
                id="log-timestamp"
                type="datetime-local"
                className="input-control text-xs"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="log-note" className="label-text">
                Note (Optional)
              </label>
              <input
                id="log-note"
                type="text"
                className="input-control text-xs"
                placeholder="e.g., Batch benchmark run, research crawl"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          {/* LIVE BALANCE PREVIEW BEFORE SAVING */}
          {livePreviews.length > 0 && (
            <div className="p-3 bg-[#181818] border border-[#2e2c29] rounded-lg space-y-2">
              <div className="flex items-center justify-between border-b border-[#2e2c29] pb-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#FF6542] font-semibold">
                  Live Balance Preview Before Saving
                </span>
                <span className="text-[10px] text-[#898580] font-mono">
                  {isPercentage ? `${amount}% applied` : `+${amount} applied`}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {livePreviews.map(({ window: win, preview }) => {
                  const unitDisplay = win.unit === 'custom' ? win.customUnitName || 'custom' : win.unit;
                  const prevRemaining = Math.max(0, win.capacity - win.currentUsed);
                  return (
                    <div
                      key={win.id}
                      className="p-2 bg-[#201f1d] rounded border border-[#2e2c29] text-xs font-mono space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[#FBFAF9]">{win.name}</span>
                        {preview.exceedsCapacity ? (
                          <span className="badge badge-danger text-[10px]">
                            Exceeds Capacity ({Math.round(preview.percentUsed)}%)
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#898580]">
                            {Math.round(preview.percentUsed)}% utilized
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#898580]">
                        <span>Used:</span>
                        <div className="flex items-center gap-1.5 font-medium text-[#FBFAF9]">
                          <span>{formatNumber(preview.previousUsed)}</span>
                          <ArrowRight className="w-3 h-3 text-[#FF6542]" />
                          <span className="text-[#FF6542]">
                            {formatNumber(preview.newUsed)} {unitDisplay}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#898580]">
                        <span>Remaining:</span>
                        <div className="flex items-center gap-1.5 font-medium text-[#FBFAF9]">
                          <span>{formatNumber(prevRemaining)}</span>
                          <ArrowRight className="w-3 h-3 text-[#10b981]" />
                          <span className={preview.remaining <= 0 ? 'text-[#ef4444]' : 'text-[#10b981]'}>
                            {formatNumber(preview.remaining)} {unitDisplay}
                          </span>
                        </div>
                      </div>

                      {/* Mini progress bar */}
                      <div className="progress-track h-1.5 mt-1">
                        <div
                          className={`progress-fill ${
                            preview.percentUsed >= 100
                              ? 'progress-fill-danger'
                              : preview.percentUsed >= 80
                              ? 'progress-fill-warning'
                              : 'progress-fill-normal'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, preview.percentUsed))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
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
              className="btn-nav-coral text-xs font-semibold"
              disabled={selectedWindowIds.length === 0}
            >
              Confirm & Save Usage
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
