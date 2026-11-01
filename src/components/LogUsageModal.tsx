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

  // Synchronize when opening
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
      setSelectedWindowIds(wins.map((w) => w.id));
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

  // Select all
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
      className="fixed inset-0 bg-[#0C0A09]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-usage-modal-title"
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
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="log-usage-modal-title" className="font-serif font-light text-2xl text-[#E7E5E4] tracking-tight">
                Log Usage Event
              </h2>
              <p className="text-xs text-[#A8A29E] font-sans mt-0.5">
                Multi-window effects are tracked without double-counting
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
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Account and Service Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="log-account" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Account <span className="text-[#D4F268]">*</span>
              </label>
              <select
                id="log-account"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
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
              <label htmlFor="log-service" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Service <span className="text-[#D4F268]">*</span>
              </label>
              <select
                id="log-service"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
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
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="log-project" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-0">
                Project <span className="text-[#D4F268]">*</span>
              </label>
              {onQuickAddProject && !isAddingProject && (
                <button
                  type="button"
                  onClick={() => setIsAddingProject(true)}
                  className="text-xs text-[#D4F268] hover:text-[#c4e450] flex items-center gap-1 bg-transparent border-0 cursor-pointer font-sans"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Quick Add Project</span>
                </button>
              )}
            </div>

            {isAddingProject ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="New project name..."
                  className="flex-1 bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateProjectInline}
                  className="btn-primary-lime bg-[#D4F268] text-[#0C0A09] font-semibold px-4 py-2 rounded-full text-xs hover:bg-[#c4e450] transition-all shadow-[0_0_12px_rgba(212,242,104,0.2)] font-sans cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingProject(false);
                    setNewProjectName('');
                  }}
                  className="btn-dark-solid bg-[#292524] text-[#E7E5E4] px-3.5 py-2 rounded-full text-xs border border-[rgba(255,255,255,0.1)] hover:bg-[#383431] transition-all font-sans cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                id="log-project"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-0">
                Affected Windows in this Service <span className="text-[#D4F268]">*</span>
              </label>
              {availableWindows.length > 1 && (
                <button
                  type="button"
                  onClick={selectAllServiceWindows}
                  className="text-xs text-[#A8A29E] hover:text-[#E7E5E4] bg-transparent border-0 cursor-pointer underline font-sans"
                >
                  Select all ({availableWindows.length})
                </button>
              )}
            </div>

            {availableWindows.length === 0 ? (
              <div className="p-4 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-xl text-center text-xs text-[#A8A29E] font-mono">
                No limit windows configured for this service.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableWindows.map((win) => {
                  const isChecked = selectedWindowIds.includes(win.id);
                  const unitDisplay = win.unit === 'custom' ? win.customUnitName || 'custom' : win.unit;
                  return (
                    <div
                      key={win.id}
                      onClick={() => toggleWindowSelection(win.id)}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        isChecked
                          ? 'bg-[#141210] border-[#D4F268] text-[#E7E5E4] shadow-[0_0_12px_rgba(212,242,104,0.15)]'
                          : 'bg-[#141210]/60 border-[rgba(255,255,255,0.08)] text-[#A8A29E] hover:border-[rgba(255,255,255,0.2)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            isChecked
                              ? 'bg-[#D4F268] border-[#D4F268] text-[#0C0A09]'
                              : 'border-[rgba(255,255,255,0.2)] bg-[#0C0A09]'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="truncate">
                          <div className="font-medium text-xs truncate text-[#E7E5E4]">{win.name}</div>
                          <div className="text-[10px] text-[#A8A29E] font-mono mt-0.5">
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
              <label htmlFor="log-amount" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Amount Used <span className="text-[#D4F268]">*</span>
              </label>
              <input
                id="log-amount"
                type="number"
                min="0.001"
                step="any"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 25"
                required
              />
            </div>

            <div>
              <label className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Amount Format
              </label>
              <div className="grid grid-cols-2 gap-1 bg-[#141210] p-1 rounded-xl border border-[rgba(255,255,255,0.12)] h-[42px] items-center">
                <button
                  type="button"
                  onClick={() => setIsPercentage(false)}
                  className={`h-full text-xs font-mono rounded-lg transition-all border-0 cursor-pointer flex items-center justify-center ${
                    !isPercentage
                      ? 'bg-[#1C1917] text-[#D4F268] font-semibold border border-[rgba(255,255,255,0.08)]'
                      : 'bg-transparent text-[#A8A29E] hover:text-[#E7E5E4]'
                  }`}
                >
                  Numeric Units
                </button>
                <button
                  type="button"
                  onClick={() => setIsPercentage(true)}
                  className={`h-full text-xs font-mono rounded-lg transition-all border-0 cursor-pointer flex items-center justify-center ${
                    isPercentage
                      ? 'bg-[#1C1917] text-[#D4F268] font-semibold border border-[rgba(255,255,255,0.08)]'
                      : 'bg-transparent text-[#A8A29E] hover:text-[#E7E5E4]'
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
              <label htmlFor="log-timestamp" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Event Date & Time
              </label>
              <input
                id="log-timestamp"
                type="datetime-local"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="log-note" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Note (Optional)
              </label>
              <input
                id="log-note"
                type="text"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                placeholder="e.g., Batch benchmark run, research crawl"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          {/* LIVE BALANCE PREVIEW BEFORE SAVING */}
          {livePreviews.length > 0 && (
            <div className="font-mono text-xs bg-[#141210] p-4 rounded-xl border border-[rgba(255,255,255,0.08)] space-y-3">
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] pb-2">
                <span className="text-xs uppercase tracking-wider text-[#D4F268] font-semibold flex items-center gap-1.5">
                  Live Balance Preview Before Saving
                </span>
                <span className="text-[11px] text-[#A8A29E]">
                  {isPercentage ? `${amount}% applied` : `+${amount} applied`}
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {livePreviews.map(({ window: win, preview }) => {
                  const unitDisplay = win.unit === 'custom' ? win.customUnitName || 'custom' : win.unit;
                  const prevRemaining = Math.max(0, win.capacity - win.currentUsed);
                  return (
                    <div
                      key={win.id}
                      className="p-3 bg-[#1C1917] rounded-xl border border-[rgba(255,255,255,0.08)] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#E7E5E4]">{win.name}</span>
                        {preview.exceedsCapacity ? (
                          <span className="badge badge-danger text-[10px]">
                            Exceeds Capacity ({Math.round(preview.percentUsed)}%)
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#A8A29E]">
                            {Math.round(preview.percentUsed)}% utilized
                          </span>
                        )}
                      </div>

                      {/* Technical Readout: Previous Used -> Incremental -> New Used */}
                      <div className="flex items-center justify-between text-[11px] text-[#A8A29E] bg-[#141210] p-2 rounded-lg">
                        <span>Used:</span>
                        <div className="flex items-center gap-1.5 font-medium">
                          <span>{formatNumber(preview.previousUsed)}</span>
                          <span className="text-[#78716C]">&rarr;</span>
                          <span className="text-[#D4F268]">+{formatNumber(preview.delta)}</span>
                          <span className="text-[#78716C]">&rarr;</span>
                          <span className="text-[#E7E5E4] font-semibold">
                            {formatNumber(preview.newUsed)} {unitDisplay}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#A8A29E]">
                        <span>Remaining:</span>
                        <div className="flex items-center gap-1.5 font-medium">
                          <span>{formatNumber(prevRemaining)}</span>
                          <ArrowRight className="w-3 h-3 text-[#10b981]" />
                          <span className={preview.remaining <= 0 ? 'text-[#f87171] font-semibold' : 'text-[#10b981] font-semibold'}>
                            {formatNumber(preview.remaining)} {unitDisplay}
                          </span>
                        </div>
                      </div>

                      {/* Percentage Bar */}
                      <div className="w-full h-1.5 bg-[#0C0A09] border border-[rgba(255,255,255,0.08)] rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${
                            preview.percentUsed >= 100
                              ? 'bg-[#f87171]'
                              : preview.percentUsed >= 80
                              ? 'bg-[#fbbf24]'
                              : 'bg-[#D4F268]'
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
