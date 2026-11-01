import React, { useState, useMemo } from 'react';
import {
  User,
  Plus,
  Edit2,
  Archive,
  ArchiveRestore,
  Server,
  ChevronDown,
  ChevronRight,
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

  // Toggle account expansion
  const toggleAccount = (id: string) => {
    setExpandedAccountIds((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id], // Default is expanded
    }));
  };

  const isAccountExpanded = (id: string) => {
    return expandedAccountIds[id] !== false; // Default true
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

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.1)] pb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-[#E7E5E4]">
            Accounts & <em>Service Limits</em>
          </h1>
          <p className="text-sm text-[#A8A29E] font-sans mt-1">
            Manage provider accounts, services, and multi-tier limit windows independently.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-sans text-[#A8A29E] hover:text-[#E7E5E4]">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded bg-[#0C0A09] border-[rgba(255,255,255,0.1)] text-[#D4F268]"
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

      {/* Account List */}
      {visibleAccounts.length === 0 ? (
        <div className="card-panel-deep p-12 text-center border border-[rgba(255,255,255,0.1)] rounded-xl space-y-3 font-mono">
          <div className="w-10 h-10 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[#D4F268] mx-auto flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-[#E7E5E4]">No accounts available</h3>
          <p className="text-xs text-[#A8A29E] max-w-sm mx-auto">
            Add an account representing a Google Workspace, GCP project, or developer identity to begin tracking limits.
          </p>
          <div className="pt-2">
            <button
              onClick={onOpenAddAccount}
              className="btn-nav-coral text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Account</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleAccounts.map((account) => {
            const isExpanded = isAccountExpanded(account.id);
            const accountServices = (serviceMap.get(account.id) || []).filter(
              (s) => (showArchived ? true : !s.archived)
            );

            return (
              <div
                key={account.id}
                className={`card-panel bg-[#1C1917] border rounded-xl overflow-hidden transition-all ${
                  account.archived ? 'border-[rgba(255,255,255,0.1)] opacity-75' : 'border-[rgba(255,255,255,0.1)]'
                }`}
              >
                {/* Account Header */}
                <div className="p-4 bg-[#1C1917] flex items-center justify-between border-b border-[rgba(255,255,255,0.1)]">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0"
                    onClick={() => toggleAccount(account.id)}
                  >
                    <button
                      type="button"
                      className="text-[#A8A29E] hover:text-[#E7E5E4] bg-transparent border-0 p-1"
                      aria-label={isExpanded ? 'Collapse account' : 'Expand account'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="w-7 h-7 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-[#D4F268] shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#E7E5E4] truncate font-mono">
                          {account.name}
                        </span>
                        {account.archived && (
                          <span className="badge badge-muted text-[10px]">Archived</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#A8A29E] font-mono flex items-center gap-3">
                        {account.email && <span>{account.email}</span>}
                        <span>Created {new Date(account.createdAt).toLocaleDateString()}</span>
                        <span>{accountServices.length} service(s)</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onOpenAddService(account.id)}
                      className="btn-dark-solid text-[11px] h-7 px-2.5"
                      title="Add a service under this account"
                    >
                      <Plus className="w-3 h-3 text-[#D4F268]" />
                      <span>Add Service</span>
                    </button>
                    <button
                      onClick={() => onOpenEditAccount(account)}
                      className="text-[#A8A29E] hover:text-[#E7E5E4] p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] bg-transparent border-0 cursor-pointer"
                      title="Edit account details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onArchiveAccount(account.id, !account.archived)}
                      className="text-[#A8A29E] hover:text-[#D4F268] p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] bg-transparent border-0 cursor-pointer"
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

                {/* Account Body: Services & Windows */}
                {isExpanded && (
                  <div className="p-4 space-y-4">
                    {account.notes && (
                      <div className="p-2.5 rounded bg-[#141210] border border-[rgba(255,255,255,0.1)] text-xs text-[#A8A29E] font-mono">
                        <span className="text-[#66635f] uppercase tracking-wider text-[10px] block mb-0.5">
                          Notes:
                        </span>
                        {account.notes}
                      </div>
                    )}

                    {accountServices.length === 0 ? (
                      <div className="p-6 bg-[#141210] border border-dashed border-[rgba(255,255,255,0.1)] rounded-lg text-center space-y-2 font-mono">
                        <p className="text-xs text-[#A8A29E]">
                          No services added to this account yet.
                        </p>
                        <button
                          onClick={() => onOpenAddService(account.id)}
                          className="btn-primary-cream text-xs h-7 px-3"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Antigravity, Google AI Studio, or Custom Service</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {accountServices.map((service) => {
                          const wins = (windowMap.get(service.id) || []).filter(
                            (w) => (showArchived ? true : !w.archived)
                          );

                          return (
                            <div
                              key={service.id}
                              className={`p-3 bg-[#141210] border rounded-lg space-y-3 ${
                                service.archived ? 'border-[rgba(255,255,255,0.1)] opacity-75' : 'border-[rgba(255,255,255,0.1)]'
                              }`}
                            >
                              {/* Service Sub-Header */}
                              <div className="flex items-center justify-between border-b border-[#1C1917] pb-2">
                                <div className="flex items-center gap-2">
                                  <Server className="w-3.5 h-3.5 text-[#D4F268]" />
                                  <span className="font-semibold text-xs text-[#E7E5E4] font-mono">
                                    {service.name}
                                  </span>
                                  {service.archived && (
                                    <span className="badge badge-muted text-[9px]">Archived</span>
                                  )}
                                  {service.notes && (
                                    <span className="text-[11px] text-[#66635f] font-mono truncate max-w-xs">
                                      — {service.notes}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() =>
                                      onOpenAddWindow(service.id, account.id, service.name)
                                    }
                                    className="text-[11px] text-[#D4F268] hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer px-1 py-0.5"
                                    title="Add another limit window to this service"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Window</span>
                                  </button>
                                  <button
                                    onClick={() => onOpenEditService(service)}
                                    className="text-[#A8A29E] hover:text-[#E7E5E4] p-1 rounded hover:bg-[#1C1917] bg-transparent border-0 cursor-pointer"
                                    title="Edit service"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => onArchiveService(service.id, !service.archived)}
                                    className="text-[#A8A29E] hover:text-[#D4F268] p-1 rounded hover:bg-[#1C1917] bg-transparent border-0 cursor-pointer"
                                    title={service.archived ? 'Restore service' : 'Archive service'}
                                  >
                                    {service.archived ? (
                                      <ArchiveRestore className="w-3 h-3" />
                                    ) : (
                                      <Archive className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Windows List */}
                              {wins.length === 0 ? (
                                <div className="text-[11px] text-[#66635f] font-mono italic py-1">
                                  No limit windows configured for this service.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {wins.map((w) => {
                                    const resetCalc = calculateReset(w);
                                    const countdown = formatResetCountdown(resetCalc);
                                    const nextResetStr = formatLocalDateTime(
                                      resetCalc.nextResetDate,
                                      w.timeZone
                                    );
                                    const unitDisplay =
                                      w.unit === 'custom' ? w.customUnitName || 'custom' : w.unit;

                                    return (
                                      <div
                                        key={w.id}
                                        className={`p-2.5 bg-[#1C1917] border rounded text-xs font-mono space-y-1.5 ${
                                          w.archived ? 'border-[rgba(255,255,255,0.1)] opacity-75' : 'border-[rgba(255,255,255,0.1)]'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-medium text-[#E7E5E4] truncate">
                                              {w.name}
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
                                              className="text-[#A8A29E] hover:text-[#E7E5E4] p-1 rounded hover:bg-[#1C1917] bg-transparent border-0 cursor-pointer"
                                              title="Edit limit window"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => onArchiveWindow(w.id, !w.archived)}
                                              className="text-[#A8A29E] hover:text-[#D4F268] p-1 rounded hover:bg-[#1C1917] bg-transparent border-0 cursor-pointer"
                                              title={w.archived ? 'Restore window' : 'Archive window'}
                                            >
                                              {w.archived ? (
                                                <ArchiveRestore className="w-3 h-3" />
                                              ) : (
                                                <Archive className="w-3 h-3" />
                                              )}
                                            </button>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-1 text-[11px] text-[#A8A29E]">
                                          <div>
                                            Capacity:{' '}
                                            <span className="text-[#E7E5E4]">
                                              {formatNumber(w.capacity)} {unitDisplay}
                                            </span>
                                          </div>
                                          <div>
                                            Cadence:{' '}
                                            <span className="text-[#D4F268]">{w.cadence}</span>
                                          </div>
                                        </div>

                                        <div className="pt-1 border-t border-[#1C1917] text-[10px] text-[#66635f] space-y-0.5">
                                          <div className="flex items-center justify-between">
                                            <span>Next Reset:</span>
                                            <span className="text-[#E7E5E4]">in {countdown}</span>
                                          </div>
                                          <div className="truncate" title={nextResetStr}>
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
