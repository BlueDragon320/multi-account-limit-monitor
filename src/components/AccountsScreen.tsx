import React, { useState, useMemo } from 'react';
import {
  User,
  Plus,
  Edit2,
  Trash2,
  Archive,
  ArchiveRestore,
  Server,
  ChevronDown,
  ChevronRight,
  Clock,
  Sparkles,
  Workflow,
  Cpu,
  Bot,
  Globe,
} from 'lucide-react';
import { AppState, Account, Service, LimitWindow } from '../domain/types';
import { calculateReset, formatResetCountdown, formatLocalDateTime } from '../domain/resetEngine';
import { formatNumber } from '../utils/formatters';

interface AccountsScreenProps {
  state: AppState;
  onOpenAddAccount: () => void;
  onOpenEditAccount: (account: Account) => void;
  onArchiveAccount: (accountId: string, archive: boolean) => void;
  onOpenAddService: (accountId: string) => void;
  onOpenEditService: (service: Service) => void;
  onArchiveService: (serviceId: string, archive: boolean) => void;
  onOpenAddWindow: (serviceId: string, accountId: string, serviceName: string) => void;
  onOpenEditWindow: (window: LimitWindow, serviceName: string) => void;
  onArchiveWindow: (windowId: string, archive: boolean) => void;
}

export const AccountsScreen: React.FC<AccountsScreenProps> = ({
  state,
  onOpenAddAccount,
  onOpenEditAccount,
  onArchiveAccount,
  onOpenAddService,
  onOpenEditService,
  onArchiveService,
  onOpenAddWindow,
  onOpenEditWindow,
  onArchiveWindow,
}) => {
  const { accounts, services, limitWindows } = state;
  const [showArchived, setShowArchived] = useState(false);
  const [expandedAccountIds, setExpandedAccountIds] = useState<Record<string, boolean>>({});

  // Toggle account expansion (default true)
  const toggleAccount = (id: string) => {
    setExpandedAccountIds((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isAccountExpanded = (id: string) => {
    return expandedAccountIds[id] !== false;
  };

  const visibleAccounts = useMemo(() => {
    return accounts.filter((a) => (showArchived ? true : !a.archived));
  }, [accounts, showArchived]);

  const serviceMap = useMemo(() => {
    const map = new Map<string, Service[]>();
    services.forEach((s) => {
      const list = map.get(s.accountId) || [];
      list.push(s);
      map.set(s.accountId, list);
    });
    return map;
  }, [services]);

  const windowMap = useMemo(() => {
    const map = new Map<string, LimitWindow[]>();
    limitWindows.forEach((w) => {
      const list = map.get(w.serviceId) || [];
      list.push(w);
      map.set(w.serviceId, list);
    });
    return map;
  }, [limitWindows]);

  // Total summary metrics
  const totalActiveAccounts = accounts.filter((a) => !a.archived).length;
  const totalActiveServices = services.filter((s) => !s.archived).length;
  const totalActiveWindows = limitWindows.filter((w) => !w.archived).length;

  // Determine provider label for an account
  const getProviderBadge = (account: Account) => {
    const text = `${account.name} ${account.notes || ''} ${account.email || ''}`.toLowerCase();
    if (text.includes('antigravity')) return 'Antigravity / Agentic';
    if (text.includes('studio') || text.includes('gemini')) return 'Google AI Studio';
    if (text.includes('gcp') || text.includes('cloud')) return 'Google Cloud (GCP)';
    if (text.includes('workspace')) return 'Google Workspace';
    return 'Google Identity / Cloud';
  };

  return (
    <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Top Action & Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.1)] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1C1917] border border-[rgba(255,255,255,0.1)] text-[11px] font-mono text-[#A8A29E] mb-2">
            <span className="w-2 h-2 rounded-full bg-[#D4F268] shadow-[0_0_8px_#D4F268]" />
            <span className="tech-tag text-[#E7E5E4]">Fig. 02 • Identity Topography</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-[#E7E5E4]">
            Accounts & <em>Service Limits</em>
          </h1>
          <p className="text-sm text-[#A8A29E] font-sans mt-1 max-w-xl">
            Manage provider accounts, services, and multi-tier limit windows independently with zero external credential leakage.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-sans text-[#A8A29E] hover:text-[#E7E5E4] select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded bg-[#0C0A09] border-[rgba(255,255,255,0.15)] text-[#D4F268] focus:ring-0 cursor-pointer"
            />
            <span>Show Archived</span>
          </label>

          <button
            onClick={onOpenAddAccount}
            className="btn-primary-lime text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Metrics Mini-Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 rounded-[16px] bg-[#141210] border border-[rgba(255,255,255,0.08)] flex items-center justify-between">
          <span className="text-[11px] text-[#A8A29E] uppercase tracking-wider font-mono">Accounts</span>
          <span className="text-lg font-mono font-medium text-[#E7E5E4]">{totalActiveAccounts}</span>
        </div>
        <div className="p-3.5 rounded-[16px] bg-[#141210] border border-[rgba(255,255,255,0.08)] flex items-center justify-between">
          <span className="text-[11px] text-[#A8A29E] uppercase tracking-wider font-mono">Services</span>
          <span className="text-lg font-mono font-medium text-[#E7E5E4]">{totalActiveServices}</span>
        </div>
        <div className="p-3.5 rounded-[16px] bg-[#141210] border border-[rgba(255,255,255,0.08)] flex items-center justify-between">
          <span className="text-[11px] text-[#A8A29E] uppercase tracking-wider font-mono">Windows</span>
          <span className="text-lg font-mono font-medium text-[#D4F268]">{totalActiveWindows}</span>
        </div>
      </div>

      {/* Empty State for Accounts */}
      {visibleAccounts.length === 0 ? (
        <div className="card-panel-deep p-12 text-center border border-[rgba(255,255,255,0.1)] rounded-[24px] max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#1C1917] border border-[rgba(255,255,255,0.12)] text-[#D4F268] mx-auto flex items-center justify-center shadow-[0_0_16px_rgba(212,242,104,0.15)]">
            <User className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-serif font-light text-[#E7E5E4]">
              No accounts available
            </h2>
            <p className="text-xs text-[#A8A29E] leading-relaxed max-w-md mx-auto">
              Add an account representing a Google Workspace, GCP project, or developer identity to begin tracking and enforcing limit windows.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={onOpenAddAccount}
              className="btn-primary-lime text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Account</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleAccounts.map((account) => {
            const isExpanded = isAccountExpanded(account.id);
            const accountServices = (serviceMap.get(account.id) || []).filter(
              (s) => (showArchived ? true : !s.archived)
            );
            const providerBadge = getProviderBadge(account);

            return (
              <div
                key={account.id}
                className={`card-panel bg-[#1C1917] border rounded-[24px] overflow-hidden transition-all duration-200 ${
                  account.archived
                    ? 'border-[rgba(255,255,255,0.06)] opacity-75'
                    : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.16)] shadow-[0_4px_24px_rgba(0,0,0,0.4)]'
                }`}
              >
                {/* Account Header Bar */}
                <div className="p-5 bg-[#1C1917] border-b border-[rgba(255,255,255,0.08)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div
                    className="flex items-center gap-3.5 cursor-pointer select-none flex-1 min-w-0"
                    onClick={() => toggleAccount(account.id)}
                  >
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full bg-[#141210] hover:bg-[#292524] text-[#A8A29E] hover:text-[#E7E5E4] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors shrink-0"
                      aria-label={isExpanded ? 'Collapse account' : 'Expand account'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="w-10 h-10 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-[#D4F268] shrink-0 shadow-[0_0_12px_rgba(212,242,104,0.12)]">
                      <User className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-base sm:text-lg text-[#E7E5E4] truncate font-mono">
                          {account.name}
                        </span>

                        {/* Provider Badge */}
                        <span className="tech-tag text-[10px] px-2.5 py-0.5 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#A8A29E] font-mono flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-[#D4F268]" />
                          <span>{providerBadge}</span>
                        </span>

                        {/* Active Status Pill */}
                        {account.archived ? (
                          <span className="badge badge-muted text-[10px]">Archived</span>
                        ) : (
                          <span className="badge badge-lime text-[10px] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D4F268] shadow-[0_0_6px_#D4F268] animate-pulse" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-[#A8A29E] font-mono flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                        {account.email && (
                          <span className="text-[#E7E5E4] opacity-90">{account.email}</span>
                        )}
                        <span>Created {new Date(account.createdAt).toLocaleDateString()}</span>
                        <span>{accountServices.length} service(s)</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => onOpenAddService(account.id)}
                      className="btn-dark-solid text-xs h-8 px-3 rounded-full hover:border-[#D4F268]"
                      title="Add a service under this account"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#D4F268]" />
                      <span>Add Service</span>
                    </button>
                    <button
                      onClick={() => onOpenEditAccount(account)}
                      className="w-8 h-8 rounded-full bg-[#141210] hover:bg-[#292524] text-[#A8A29E] hover:text-[#E7E5E4] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                      title="Edit account details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onArchiveAccount(account.id, !account.archived)}
                      className="w-8 h-8 rounded-full bg-[#141210] hover:bg-[#292524] text-[#A8A29E] hover:text-[#D4F268] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                      title={account.archived ? 'Restore account' : 'Archive account'}
                    >
                      {account.archived ? (
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Account Body: Services, Limit Windows, Presets */}
                {isExpanded && (
                  <div className="p-6 space-y-6">
                    {/* Optional Account Notes */}
                    {account.notes && (
                      <div className="p-3.5 rounded-[16px] bg-[#141210] border border-[rgba(255,255,255,0.08)] text-xs text-[#A8A29E] font-mono leading-relaxed">
                        <span className="tech-tag text-[10px] text-[#78716C] block mb-1">
                          Operational Architecture Notes:
                        </span>
                        {account.notes}
                      </div>
                    )}

                    {/* Presets Quick-Add Strip */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
                      <span className="tech-tag text-[10px] text-[#78716C] mr-1">
                        Service Presets:
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenAddService(account.id)}
                        className="preset-chip-btn"
                        title="Add Antigravity burst & weekly quota preset"
                      >
                        <Sparkles className="w-3 h-3 text-[#D4F268]" />
                        <span>Antigravity</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenAddService(account.id)}
                        className="preset-chip-btn"
                        title="Add Google Flow monthly allowance preset"
                      >
                        <Workflow className="w-3 h-3 text-[#38bdf8]" />
                        <span>Google Flow</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenAddService(account.id)}
                        className="preset-chip-btn"
                        title="Add Google AI Studio daily RPD preset"
                      >
                        <Cpu className="w-3 h-3 text-[#fbbf24]" />
                        <span>Google AI Studio</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenAddService(account.id)}
                        className="preset-chip-btn"
                        title="Add Gemini prompt limit preset"
                      >
                        <Bot className="w-3 h-3 text-[#a78bfa]" />
                        <span>Gemini</span>
                      </button>
                    </div>

                    {/* Services List / Empty Services State */}
                    {accountServices.length === 0 ? (
                      <div className="card-panel-deep bg-[#141210] border border-dashed border-[rgba(255,255,255,0.12)] rounded-[20px] p-8 text-center space-y-4">
                        <div className="w-10 h-10 rounded-full bg-[#1C1917] border border-[rgba(255,255,255,0.1)] text-[#D4F268] mx-auto flex items-center justify-center">
                          <Server className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-[#E7E5E4] font-mono">
                            No services added to this account yet.
                          </p>
                          <p className="text-xs text-[#A8A29E] max-w-md mx-auto">
                            Add a managed service with preset limits or define a custom API quota.
                          </p>
                        </div>
                        <div className="pt-2">
                          <button
                            onClick={() => onOpenAddService(account.id)}
                            className="btn-primary-cream text-xs h-8 px-4 rounded-full"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Antigravity, Google AI Studio, or Custom Service</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {accountServices.map((service) => {
                          const wins = (windowMap.get(service.id) || []).filter(
                            (w) => (showArchived ? true : !w.archived)
                          );

                          return (
                            <div
                              key={service.id}
                              className={`card-panel-deep bg-[#141210] border rounded-[20px] p-5 space-y-4 transition-all ${
                                service.archived
                                  ? 'border-[rgba(255,255,255,0.06)] opacity-75'
                                  : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)]'
                              }`}
                            >
                              {/* Service Sub-Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] pb-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-[#1C1917] border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-[#D4F268] shrink-0">
                                    <Server className="w-3 h-3" />
                                  </div>
                                  <span className="font-semibold text-sm text-[#E7E5E4] font-mono truncate">
                                    {service.name}
                                  </span>
                                  {service.archived ? (
                                    <span className="badge badge-muted text-[9px]">Archived</span>
                                  ) : (
                                    <span className="badge badge-lime text-[9px]">Active</span>
                                  )}
                                  {service.notes && (
                                    <span className="text-xs text-[#78716C] font-mono truncate hidden md:inline">
                                      — {service.notes}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() =>
                                      onOpenAddWindow(service.id, account.id, service.name)
                                    }
                                    className="btn-dark-solid text-xs h-7 px-3 rounded-full hover:border-[#D4F268]"
                                    title="Add another limit window to this service"
                                  >
                                    <Plus className="w-3 h-3 text-[#D4F268]" />
                                    <span>Add Window</span>
                                  </button>
                                  <button
                                    onClick={() => onOpenEditService(service)}
                                    className="w-7 h-7 rounded-full bg-[#1C1917] hover:bg-[#292524] text-[#A8A29E] hover:text-[#E7E5E4] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                                    title="Edit service details"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => onArchiveService(service.id, !service.archived)}
                                    className="w-7 h-7 rounded-full bg-[#1C1917] hover:bg-[rgba(248,113,113,0.15)] text-[#A8A29E] hover:text-[#f87171] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                                    title={service.archived ? 'Restore service' : 'Delete / Archive service'}
                                  >
                                    {service.archived ? (
                                      <ArchiveRestore className="w-3 h-3" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Windows List */}
                              {wins.length === 0 ? (
                                <div className="p-4 rounded-[16px] bg-[#1C1917] border border-dashed border-[rgba(255,255,255,0.08)] text-center text-xs text-[#78716C] font-mono">
                                  No limit windows configured for this service.{' '}
                                  <button
                                    onClick={() =>
                                      onOpenAddWindow(service.id, account.id, service.name)
                                    }
                                    className="text-[#D4F268] hover:underline bg-transparent border-0 cursor-pointer ml-1"
                                  >
                                    Add First Window &rarr;
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {wins.map((w) => {
                                    const resetCalc = calculateReset(w);
                                    const countdown = formatResetCountdown(resetCalc);
                                    const nextResetStr = formatLocalDateTime(
                                      resetCalc.nextResetDate,
                                      w.timeZone
                                    );
                                    const unitDisplay =
                                      w.unit === 'custom' ? w.customUnitName || 'custom' : w.unit;
                                    const percent =
                                      w.capacity > 0 ? (w.currentUsed / w.capacity) * 100 : 0;
                                    const remaining = Math.max(0, w.capacity - w.currentUsed);
                                    const isCritical = percent >= 90;
                                    const isWarning = percent >= 75 && percent < 90;

                                    return (
                                      <div
                                        key={w.id}
                                        className={`p-4 bg-[#1C1917] border rounded-[16px] font-mono space-y-3 transition-colors ${
                                          w.archived
                                            ? 'border-[rgba(255,255,255,0.06)] opacity-70'
                                            : isCritical
                                            ? 'border-[rgba(248,113,113,0.3)]'
                                            : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)]'
                                        }`}
                                      >
                                        {/* Window Header */}
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-semibold text-xs sm:text-sm text-[#E7E5E4] truncate">
                                              {w.name}
                                            </span>
                                            <span className="badge badge-lime text-[9px] uppercase tracking-wider">
                                              {w.cadence}
                                            </span>
                                            {w.archived && (
                                              <span className="badge badge-muted text-[8px]">
                                                Archived
                                              </span>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              onClick={() => onOpenEditWindow(w, service.name)}
                                              className="w-6 h-6 rounded-full bg-[#141210] hover:bg-[#292524] text-[#A8A29E] hover:text-[#E7E5E4] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                                              title="Edit limit window"
                                            >
                                              <Edit2 className="w-2.5 h-2.5" />
                                            </button>
                                            <button
                                              onClick={() => onArchiveWindow(w.id, !w.archived)}
                                              className="w-6 h-6 rounded-full bg-[#141210] hover:bg-[rgba(248,113,113,0.15)] text-[#A8A29E] hover:text-[#f87171] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                                              title={w.archived ? 'Restore window' : 'Delete / Archive window'}
                                            >
                                              {w.archived ? (
                                                <ArchiveRestore className="w-2.5 h-2.5" />
                                              ) : (
                                                <Trash2 className="w-2.5 h-2.5" />
                                              )}
                                            </button>
                                          </div>
                                        </div>

                                        {/* Capacity & Usage Breakdown */}
                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="text-[#A8A29E]">
                                              Used:{' '}
                                              <strong
                                                className={
                                                  isCritical
                                                    ? 'text-[#f87171]'
                                                    : isWarning
                                                    ? 'text-[#fbbf24]'
                                                    : 'text-[#D4F268]'
                                                }
                                              >
                                                {formatNumber(w.currentUsed)}
                                              </strong>{' '}
                                              <span className="text-[#78716C]">
                                                / {formatNumber(w.capacity)} {unitDisplay}
                                              </span>
                                            </span>
                                            <span
                                              className={`text-xs font-semibold ${
                                                isCritical
                                                  ? 'text-[#f87171]'
                                                  : isWarning
                                                  ? 'text-[#fbbf24]'
                                                  : 'text-[#D4F268]'
                                              }`}
                                            >
                                              {Math.round(percent)}%
                                            </span>
                                          </div>

                                          {/* Progress Track */}
                                          <div className="progress-track h-2 bg-[#141210] rounded-full overflow-hidden border border-[rgba(255,255,255,0.06)]">
                                            <div
                                              className={`h-full rounded-full transition-all duration-300 ${
                                                isCritical
                                                  ? 'bg-[#f87171]'
                                                  : isWarning
                                                  ? 'bg-[#fbbf24]'
                                                  : 'bg-[#D4F268]'
                                              }`}
                                              style={{
                                                width: `${Math.min(100, Math.max(0, percent))}%`,
                                              }}
                                            />
                                          </div>

                                          <div className="flex items-center justify-between text-[10px] text-[#A8A29E] pt-0.5">
                                            <span>
                                              Remaining:{' '}
                                              <strong className="text-[#E7E5E4]">
                                                {formatNumber(remaining)} {unitDisplay}
                                              </strong>
                                            </span>
                                            <span className="text-[#78716C]">
                                              Cadence:{' '}
                                              <span className="text-[#E7E5E4]">{w.cadence}</span>
                                            </span>
                                          </div>
                                        </div>

                                        {/* Next Reset Footer */}
                                        <div className="p-2 rounded-[10px] bg-[#141210] border border-[rgba(255,255,255,0.06)] text-[10px] space-y-0.5">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[#78716C] flex items-center gap-1">
                                              <Clock className="w-3 h-3 text-[#A8A29E]" />
                                              Next Reset:
                                            </span>
                                            <span className="text-[#D4F268] font-medium">
                                              in {countdown}
                                            </span>
                                          </div>
                                          <div className="text-[#78716C] truncate" title={nextResetStr}>
                                            {nextResetStr} ({w.timeZone})
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
