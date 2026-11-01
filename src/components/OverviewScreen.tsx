import React, { useState, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  Plus,
  RotateCcw,
  Filter,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import { AppState } from '../domain/types';
import { isLowCapacity, isStaleData } from '../domain/calculations';
import {
  calculateReset,
  formatResetCountdown,
  formatLocalDateTime,
} from '../domain/resetEngine';
import { formatNumber, formatRelativeTime } from '../utils/formatters';

interface OverviewScreenProps {
  state: AppState;
  onOpenLogUsage: (preselectedWindowId?: string) => void;
  onOpenCorrectBalance: (windowId: string) => void;
  onNavigateToAccounts: () => void;
  onOpenAddAccount: () => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  state,
  onOpenLogUsage,
  onOpenCorrectBalance,
  onNavigateToAccounts,
  onOpenAddAccount,
}) => {
  const { accounts, services, limitWindows, settings } = state;

  // Filter & Sort State
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'stale'>('all');
  const [sortBy, setSortBy] = useState<'reset' | 'remaining' | 'utilization' | 'updated'>('reset');

  // Lookups
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  // Active limit windows
  const activeWindows = useMemo(() => {
    return limitWindows.filter((w) => {
      if (w.archived) return false;
      const acc = accountMap.get(w.accountId);
      if (acc && acc.archived) return false;
      const svc = serviceMap.get(w.serviceId);
      if (svc && svc.archived) return false;
      return true;
    });
  }, [limitWindows, accountMap, serviceMap]);

  // Top stats
  const activeAccountsCount = useMemo(() => accounts.filter((a) => !a.archived).length, [accounts]);
  const activeWindowsCount = activeWindows.length;

  const lowCapacityWindows = useMemo(() => {
    return activeWindows.filter((w) =>
      isLowCapacity(w, settings.lowCapacityThresholdPercent ?? 80)
    );
  }, [activeWindows, settings.lowCapacityThresholdPercent]);

  const staleWindows = useMemo(() => {
    return activeWindows.filter((w) =>
      isStaleData(w, settings.staleDataThresholdHours ?? 24)
    );
  }, [activeWindows, settings.staleDataThresholdHours]);

  // Available services for the filter dropdown
  const filteredServicesList = useMemo(() => {
    if (selectedAccountId === 'all') {
      return services.filter((s) => !s.archived);
    }
    return services.filter((s) => s.accountId === selectedAccountId && !s.archived);
  }, [services, selectedAccountId]);

  // Evaluated window data with reset engine calculations
  const windowItems = useMemo(() => {
    const now = new Date();
    return activeWindows.map((win) => {
      const resetResult = calculateReset(win, now);
      const isLow = isLowCapacity(win, settings.lowCapacityThresholdPercent ?? 80);
      const isStale = isStaleData(win, settings.staleDataThresholdHours ?? 24, now);
      const remaining = Math.max(0, win.capacity - win.currentUsed);
      const percentUsed = win.capacity > 0 ? (win.currentUsed / win.capacity) * 100 : 0;
      const unitDisplay = win.unit === 'custom' ? win.customUnitName || 'custom' : win.unit;

      return {
        window: win,
        account: accountMap.get(win.accountId),
        service: serviceMap.get(win.serviceId),
        resetResult,
        isLow,
        isStale,
        remaining,
        percentUsed,
        unitDisplay,
      };
    });
  }, [activeWindows, accountMap, serviceMap, settings]);

  // Filtered & Sorted items
  const processedItems = useMemo(() => {
    let list = windowItems.filter((item) => {
      if (selectedAccountId !== 'all' && item.window.accountId !== selectedAccountId) {
        return false;
      }
      if (selectedServiceId !== 'all' && item.window.serviceId !== selectedServiceId) {
        return false;
      }
      if (statusFilter === 'low' && !item.isLow) {
        return false;
      }
      if (statusFilter === 'stale' && !item.isStale) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'reset') {
        return a.resetResult.timeRemainingMs - b.resetResult.timeRemainingMs;
      }
      if (sortBy === 'remaining') {
        return a.remaining - b.remaining;
      }
      if (sortBy === 'utilization') {
        return b.percentUsed - a.percentUsed;
      }
      if (sortBy === 'updated') {
        return new Date(b.window.lastUpdated).getTime() - new Date(a.window.lastUpdated).getTime();
      }
      return 0;
    });

    return list;
  }, [windowItems, selectedAccountId, selectedServiceId, statusFilter, sortBy]);

  return (
    <div className="hero-glow-container w-full min-h-[calc(100vh-80px)] pb-24">
      {/* Background Radial Glow */}
      <div className="hero-radial-glow" aria-hidden="true" />

      <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 space-y-8 relative z-10">
        {/* Top Hero / Header Section */}
        <section className="text-center space-y-3 pt-2 w-full">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1C1917] border border-[rgba(255,255,255,0.1)] text-[12px] font-sans text-[#A8A29E] mb-1">
            <span className="w-2 h-2 rounded-full bg-[#D4F268] shadow-[0_0_8px_#D4F268] animate-pulse" />
            <span className="tech-tag">Fig. 01 • Cadence Intelligence</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif font-light tracking-tight text-[#E7E5E4]">
            Active Limit Windows & <em>Quota Health</em>
          </h1>
          <p className="text-sm sm:text-base text-[#A8A29E] max-w-2xl mx-auto font-sans leading-relaxed">
            Calm, unified visibility across Google Cloud, Antigravity, and AI Studio quotas without automated third-party telemetry scraping.
          </p>
        </section>

        {/* Top Stats Summary */}
        <section
          aria-label="Quota Summary Metrics"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full"
        >
          <div className="bg-[#141210] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)] rounded-[24px] p-6 sm:p-7 min-h-[145px] flex flex-col justify-between transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs text-[#A8A29E] font-medium tracking-wider uppercase font-mono">
                Active Accounts
              </span>
              <span className="tech-tag text-[10px] text-[#78716C]">Fig. 01A</span>
            </div>
            <div className="my-3">
              <span className="text-3xl sm:text-4xl font-light font-mono text-[#E7E5E4] tracking-tight">
                {activeAccountsCount}
              </span>
            </div>
            <div className="text-xs sm:text-[13px] text-[#A8A29E] font-sans">
              Independent identities tracked
            </div>
          </div>

          <div className="bg-[#141210] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)] rounded-[24px] p-6 sm:p-7 min-h-[145px] flex flex-col justify-between transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs text-[#A8A29E] font-medium tracking-wider uppercase font-mono">
                Active Windows
              </span>
              <span className="tech-tag text-[10px] text-[#78716C]">Fig. 01B</span>
            </div>
            <div className="my-3">
              <span className="text-3xl sm:text-4xl font-light font-mono text-[#E7E5E4] tracking-tight">
                {activeWindowsCount}
              </span>
            </div>
            <div className="text-xs sm:text-[13px] text-[#A8A29E] font-sans">
              Independent reset cadences
            </div>
          </div>

          <div className="bg-[#141210] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)] rounded-[24px] p-6 sm:p-7 min-h-[145px] flex flex-col justify-between transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs text-[#A8A29E] font-medium tracking-wider uppercase font-mono flex items-center gap-1.5">
                <span>Near Limit (&ge;{settings.lowCapacityThresholdPercent}%)</span>
                {lowCapacityWindows.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-[#f87171] shadow-[0_0_6px_#f87171] animate-pulse" />
                )}
              </span>
              <span className="tech-tag text-[10px] text-[#78716C]">Fig. 01C</span>
            </div>
            <div className="my-3">
              <span
                className={`text-3xl sm:text-4xl font-light font-mono tracking-tight ${
                  lowCapacityWindows.length > 0 ? 'text-[#f87171]' : 'text-[#E7E5E4]'
                }`}
              >
                {lowCapacityWindows.length}
              </span>
            </div>
            <div className="text-xs sm:text-[13px] text-[#A8A29E] font-sans">
              Requires attention or switch
            </div>
          </div>

          <div className="bg-[#141210] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)] rounded-[24px] p-6 sm:p-7 min-h-[145px] flex flex-col justify-between transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs text-[#A8A29E] font-medium tracking-wider uppercase font-mono flex items-center gap-1.5">
                <span>Stale (&gt;{settings.staleDataThresholdHours}h)</span>
                {staleWindows.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-[#fbbf24] shadow-[0_0_6px_#fbbf24] animate-pulse" />
                )}
              </span>
              <span className="tech-tag text-[10px] text-[#78716C]">Fig. 01D</span>
            </div>
            <div className="my-3">
              <span
                className={`text-3xl sm:text-4xl font-light font-mono tracking-tight ${
                  staleWindows.length > 0 ? 'text-[#fbbf24]' : 'text-[#E7E5E4]'
                }`}
              >
                {staleWindows.length}
              </span>
            </div>
            <div className="text-xs sm:text-[13px] text-[#A8A29E] font-sans">
              Needs console balance check
            </div>
          </div>
        </section>

        {/* Serrated Postage-Stamp Tear Effect Divider */}
        <div className="serrated-divider" aria-hidden="true" />

        {/* Filter and Sort Toolbar */}
        <section
          aria-label="Filter and Sort Toolbar"
          className="card-panel p-4 sm:p-5 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] flex flex-wrap items-center justify-between gap-4 text-xs font-sans w-full"
        >
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[#A8A29E] font-mono text-xs uppercase tracking-wider shrink-0">
              <Filter className="w-4 h-4 text-[#D4F268]" />
              <span>Filters:</span>
            </div>

            {/* Filter Account */}
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setSelectedServiceId('all');
              }}
              className="bg-[#141210] text-[#E7E5E4] border border-[rgba(255,255,255,0.12)] rounded-full px-4 py-2 text-xs font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] cursor-pointer hover:border-[rgba(255,255,255,0.2)] transition-all"
              aria-label="Filter by account"
            >
              <option value="all">All Accounts ({accounts.filter((a) => !a.archived).length})</option>
              {accounts
                .filter((a) => !a.archived)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
            </select>

            {/* Filter Service */}
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="bg-[#141210] text-[#E7E5E4] border border-[rgba(255,255,255,0.12)] rounded-full px-4 py-2 text-xs font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] cursor-pointer hover:border-[rgba(255,255,255,0.2)] transition-all"
              aria-label="Filter by service"
            >
              <option value="all">
                {selectedAccountId === 'all'
                  ? `All Services (${filteredServicesList.length})`
                  : `Services for Account (${filteredServicesList.length})`}
              </option>
              {filteredServicesList.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <div className="flex items-center gap-1 bg-[#141210] p-1 rounded-full border border-[rgba(255,255,255,0.08)] flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`cursor-pointer px-3.5 py-1.5 rounded-full text-xs font-sans transition-all border ${
                  statusFilter === 'all'
                    ? 'bg-[#292524] text-[#E7E5E4] border-[rgba(255,255,255,0.2)] font-medium'
                    : 'bg-transparent text-[#A8A29E] hover:text-[#E7E5E4] border-transparent'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('low')}
                className={`cursor-pointer px-3.5 py-1.5 rounded-full text-xs font-sans transition-all border ${
                  statusFilter === 'low'
                    ? 'bg-[rgba(248,113,113,0.18)] text-[#f87171] border-[rgba(248,113,113,0.4)] font-semibold'
                    : 'bg-transparent text-[#A8A29E] hover:text-[#f87171] border-transparent'
                }`}
              >
                Near Limit ({lowCapacityWindows.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('stale')}
                className={`cursor-pointer px-3.5 py-1.5 rounded-full text-xs font-sans transition-all border ${
                  statusFilter === 'stale'
                    ? 'bg-[rgba(251,191,36,0.18)] text-[#fbbf24] border-[rgba(251,191,36,0.4)] font-semibold'
                    : 'bg-transparent text-[#A8A29E] hover:text-[#fbbf24] border-transparent'
                }`}
              >
                Stale ({staleWindows.length})
              </button>
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs text-[#A8A29E] flex items-center gap-1.5 font-sans">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#141210] text-[#E7E5E4] border border-[rgba(255,255,255,0.12)] rounded-full px-4 py-2 text-xs font-sans outline-none focus:border-[#D4F268] cursor-pointer hover:border-[rgba(255,255,255,0.2)] transition-all"
              aria-label="Sort limit windows"
            >
              <option value="reset">Next Reset (Soonest first)</option>
              <option value="remaining">Remaining (Least first)</option>
              <option value="utilization">Utilization (% Used highest)</option>
              <option value="updated">Last Updated (Most recent)</option>
            </select>
          </div>
        </section>

        {/* Limit Windows Card Grid */}
        <section aria-label="Limit Windows" className="space-y-6 w-full">
          {processedItems.length === 0 ? (
            /* Clean polite sample-free empty state */
            <div className="card-panel-deep bg-[#141210] p-12 sm:p-16 text-center border border-[rgba(255,255,255,0.08)] rounded-[24px] flex flex-col items-center justify-center space-y-4 w-full">
              <div className="w-14 h-14 rounded-full bg-[#1C1917] border border-[#D4F268] text-[#D4F268] shadow-[0_0_16px_rgba(212,242,104,0.2)] flex items-center justify-center">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-light text-[#E7E5E4]">
                  {activeWindowsCount === 0
                    ? 'No limit windows configured yet'
                    : 'No limit windows match your filter criteria'}
                </h3>
                <p className="text-sm text-[#A8A29E] max-w-md mx-auto font-sans leading-relaxed">
                  {activeWindowsCount === 0
                    ? 'Quota Ember tracks your self-reported limits and reset dates cleanly. Start by adding an account and selecting an Antigravity, Google Flow, or Google AI Studio preset.'
                    : 'Try loosening your account, service, or status filters above to view other windows.'}
                </p>
              </div>

              {activeWindowsCount === 0 && (
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={onOpenAddAccount}
                    className="btn-primary-lime text-xs font-sans font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Account</span>
                  </button>
                  <button
                    onClick={onNavigateToAccounts}
                    className="btn-dark-solid text-xs font-sans cursor-pointer"
                  >
                    <span>View Accounts &amp; Presets</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
              {processedItems.map(
                ({
                  window: win,
                  account,
                  service,
                  resetResult,
                  isLow,
                  isStale,
                  remaining,
                  percentUsed,
                  unitDisplay,
                }) => {
                  const countdown = formatResetCountdown(resetResult);
                  const resetFormatted = formatLocalDateTime(
                    resetResult.nextResetDate,
                    win.timeZone
                  );
                  const progressColorClass =
                    percentUsed >= 100
                      ? 'progress-fill-danger'
                      : isLow
                      ? 'progress-fill-warning'
                      : 'progress-fill-normal';

                  return (
                    <article
                      key={win.id}
                      className="card-panel p-6 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] flex flex-col justify-between hover:border-[rgba(255,255,255,0.2)] transition-all group"
                      aria-labelledby={`card-title-${win.id}`}
                    >
                      <div className="space-y-4">
                        {/* Header: Account & Service path + Badges */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] text-[#A8A29E] font-sans truncate">
                              {account ? account.name : 'Unknown Account'}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isLow && (
                                <span className="badge badge-danger text-[10px]" title="Remaining capacity is near limit">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Near Limit</span>
                                </span>
                              )}
                              {isStale && (
                                <span className="badge badge-warning text-[10px]" title="Record has not been updated within stale threshold">
                                  <Clock className="w-3 h-3" />
                                  <span>Stale</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-baseline justify-between gap-2">
                            <h2
                              id={`card-title-${win.id}`}
                              className="text-xl font-serif font-light text-[#E7E5E4] truncate tracking-tight"
                            >
                              {win.name}
                            </h2>
                            <span className="text-[11px] font-mono text-[#D4F268] bg-[#141210] px-2.5 py-0.5 rounded-full border border-[rgba(212,242,104,0.3)] shrink-0">
                              {win.cadence}
                            </span>
                          </div>

                          <div className="text-[11px] text-[#A8A29E] font-mono flex items-center gap-1.5">
                            <span>Service:</span>
                            <span className="text-[#E7E5E4] bg-[#141210] px-2 py-0.5 rounded-md border border-[rgba(255,255,255,0.08)] font-sans text-xs">
                              {service ? service.name : 'Custom'}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar & Numeric Labels */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-[#E7E5E4] font-medium">
                              {formatNumber(win.currentUsed)} / {formatNumber(win.capacity)} {unitDisplay}
                            </span>
                            <span className="font-semibold text-[#A8A29E]">
                              {Math.round(percentUsed)}%
                            </span>
                          </div>

                          {/* Accessible progress bar */}
                          <div
                            className="progress-track"
                            role="progressbar"
                            aria-valuenow={Math.round(percentUsed)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${win.name} capacity utilization: ${Math.round(percentUsed)}%`}
                          >
                            <div
                              className={`progress-fill ${progressColorClass}`}
                              style={{ width: `${Math.min(100, Math.max(0, percentUsed))}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#A8A29E] font-mono pt-0.5">
                            <span>Remaining:</span>
                            <span className={remaining <= 0 ? 'text-[#f87171] font-semibold' : 'text-[#D4F268] font-semibold'}>
                              {formatNumber(remaining)} {unitDisplay}
                            </span>
                          </div>
                        </div>

                        {/* Timing and Reset Info */}
                        <div className="p-3 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-[16px] text-[11px] font-mono space-y-2 text-[#A8A29E]">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <RotateCcw className="w-3 h-3 text-[#D4F268]" />
                              <span>Next Reset:</span>
                            </span>
                            <span
                              className={`font-mono font-semibold ${
                                resetResult.isPastDue
                                  ? 'text-[#f87171]'
                                  : 'text-[#D4F268]'
                              }`}
                            >
                              {resetResult.isPastDue ? 'Past Due (advancing)' : `in ${countdown}`}
                            </span>
                          </div>

                          <div className="text-[10px] text-[#78716C] truncate" title={resetFormatted}>
                            {resetFormatted} ({win.timeZone})
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-[rgba(255,255,255,0.06)] text-[10px]">
                            <span>Last Updated:</span>
                            <span className="text-[#A8A29E]" title={win.lastUpdated}>
                              {formatRelativeTime(win.lastUpdated)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-4 mt-2 border-t border-[rgba(255,255,255,0.08)]">
                        <button
                          onClick={() => onOpenLogUsage(win.id)}
                          className="btn-dark-solid text-xs justify-center h-9 rounded-full cursor-pointer hover:border-[rgba(212,242,104,0.4)]"
                          title="Log usage for this window"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#D4F268]" />
                          <span>Log</span>
                        </button>
                        <button
                          onClick={() => onOpenCorrectBalance(win.id)}
                          className="btn-secondary-square text-xs justify-center h-9 rounded-full cursor-pointer hover:border-[#D4F268]"
                          title="Calibrate balance to match provider console"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Calibrate</span>
                        </button>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* Editorial Founder / Owner Note Card */}
        <section
          aria-label="Owner Advisory Card"
          className="founder-note-card relative overflow-hidden bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] p-6 sm:p-8 w-full"
        >
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="tech-tag text-[11px] text-[#D4F268] font-bold">
                  Fig. 02 • Operational Architecture
                </span>
                <span className="text-xs text-[#A8A29E] font-serif italic">— calibration guide</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-serif font-light text-[#E7E5E4] tracking-tight">
                Manual Estimates & <em>Reset Anchor Precision</em>
              </h3>
              <p className="text-[#A8A29E] text-sm leading-relaxed font-sans">
                Quota Ember runs locally without credentials, background token sniffers, or secret provider API keys.
                All figures represent your logged usage and manual balance corrections. Reset schedules strictly follow your configured
                anchors: hourly intervals count from the minute of the hour, daily windows advance at your local wall-clock hour,
                and monthly cadences automatically clamp to month-ends (e.g. 31st to 28th/30th) across Daylight Saving transitions.
              </p>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="inline-block px-4 py-1.5 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[#D4F268] text-xs font-mono font-medium">
                100% Client-Side Local
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
