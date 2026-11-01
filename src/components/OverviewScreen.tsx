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

      <main className="max-w-[1200px] mx-auto px-4 pt-6 space-y-8 relative z-10">
        {/* Top Hero / Header Section */}
        <section className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#201f1d] border border-[#2e2c29] text-[11px] font-mono text-[#898580] mb-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6542] animate-pulse" />
            <span>Local-first manual quota & cadence intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FBFAF9]">
            Active Limit Windows & Quota Health
          </h1>
          <p className="text-xs sm:text-sm text-[#898580] max-w-2xl mx-auto font-mono">
            Calm, unified visibility across Google Cloud, Antigravity, and AI Studio quotas without automated third-party telemetry scraping.
          </p>
        </section>

        {/* Top Stats Summary */}
        <section
          aria-label="Quota Summary Metrics"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          <div className="card-panel-deep p-4 border border-[#2e2c29] flex flex-col justify-between">
            <div className="text-[11px] text-[#898580] uppercase tracking-wider font-mono">
              Active Accounts
            </div>
            <div className="text-2xl font-bold font-mono text-[#FBFAF9] mt-2">
              {activeAccountsCount}
            </div>
            <div className="text-[10px] text-[#66635f] mt-1 font-mono">
              Independent identities tracked
            </div>
          </div>

          <div className="card-panel-deep p-4 border border-[#2e2c29] flex flex-col justify-between">
            <div className="text-[11px] text-[#898580] uppercase tracking-wider font-mono">
              Active Windows
            </div>
            <div className="text-2xl font-bold font-mono text-[#FBFAF9] mt-2">
              {activeWindowsCount}
            </div>
            <div className="text-[10px] text-[#66635f] mt-1 font-mono">
              Independent reset cadences
            </div>
          </div>

          <div className="card-panel-deep p-4 border border-[#2e2c29] flex flex-col justify-between">
            <div className="text-[11px] text-[#898580] uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>Near Limit (&ge;{settings.lowCapacityThresholdPercent}%)</span>
              {lowCapacityWindows.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#FF6542]" />
              )}
            </div>
            <div
              className={`text-2xl font-bold font-mono mt-2 ${
                lowCapacityWindows.length > 0 ? 'text-[#FF6542]' : 'text-[#FBFAF9]'
              }`}
            >
              {lowCapacityWindows.length}
            </div>
            <div className="text-[10px] text-[#66635f] mt-1 font-mono">
              Requires attention or switch
            </div>
          </div>

          <div className="card-panel-deep p-4 border border-[#2e2c29] flex flex-col justify-between">
            <div className="text-[11px] text-[#898580] uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>Stale (&gt;{settings.staleDataThresholdHours}h)</span>
              {staleWindows.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
              )}
            </div>
            <div
              className={`text-2xl font-bold font-mono mt-2 ${
                staleWindows.length > 0 ? 'text-[#f59e0b]' : 'text-[#FBFAF9]'
              }`}
            >
              {staleWindows.length}
            </div>
            <div className="text-[10px] text-[#66635f] mt-1 font-mono">
              Needs console balance check
            </div>
          </div>
        </section>

        {/* Filter and Sort Toolbar */}
        <section
          aria-label="Filter and Sort Toolbar"
          className="card-panel p-3 bg-[#201f1d] border border-[#2e2c29] flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-[#898580]">
              <Filter className="w-3.5 h-3.5 text-[#FF6542]" />
              <span className="text-[11px] uppercase tracking-wider">Filters:</span>
            </div>

            {/* Filter Account */}
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setSelectedServiceId('all');
              }}
              className="bg-[#181818] border border-[#2e2c29] text-[#FBFAF9] rounded px-2.5 py-1 text-xs outline-none focus:border-[#FF6542]"
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
              className="bg-[#181818] border border-[#2e2c29] text-[#FBFAF9] rounded px-2.5 py-1 text-xs outline-none focus:border-[#FF6542]"
              aria-label="Filter by service"
            >
              <option value="all">All Services</option>
              {filteredServicesList.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <div className="flex items-center gap-1 bg-[#181818] p-0.5 rounded border border-[#2e2c29]">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors border-0 cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-[#252422] text-[#FBFAF9]'
                    : 'bg-transparent text-[#898580] hover:text-[#FBFAF9]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('low')}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors border-0 cursor-pointer ${
                  statusFilter === 'low'
                    ? 'bg-[#FF6542] text-white font-medium'
                    : 'bg-transparent text-[#898580] hover:text-[#FBFAF9]'
                }`}
              >
                Near Limit ({lowCapacityWindows.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('stale')}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors border-0 cursor-pointer ${
                  statusFilter === 'stale'
                    ? 'bg-[#f59e0b] text-[#0C0B09] font-medium'
                    : 'bg-transparent text-[#898580] hover:text-[#FBFAF9]'
                }`}
              >
                Stale ({staleWindows.length})
              </button>
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#898580] flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#181818] border border-[#2e2c29] text-[#FBFAF9] rounded px-2.5 py-1 text-xs outline-none focus:border-[#FF6542]"
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
        <section aria-label="Limit Windows" className="space-y-4">
          {processedItems.length === 0 ? (
            /* Clean polite sample-free empty state */
            <div className="card-panel-deep p-12 text-center border border-[#2e2c29] rounded-xl space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#181818] border border-[#2e2c29] text-[#FF6542] mx-auto flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#FBFAF9]">
                  {activeWindowsCount === 0
                    ? 'No limit windows configured yet'
                    : 'No limit windows match your filter criteria'}
                </h3>
                <p className="text-xs text-[#898580] max-w-md mx-auto font-mono">
                  {activeWindowsCount === 0
                    ? 'Quota Ember tracks your self-reported limits and reset dates cleanly. Start by adding an account and selecting an Antigravity, Google Flow, or Google AI Studio preset.'
                    : 'Try loosening your account, service, or status filters above to view other windows.'}
                </p>
              </div>

              {activeWindowsCount === 0 && (
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    onClick={onOpenAddAccount}
                    className="btn-nav-coral text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Account</span>
                  </button>
                  <button
                    onClick={onNavigateToAccounts}
                    className="btn-dark-solid text-xs"
                  >
                    <span>View Accounts & Presets</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      className="card-panel p-5 bg-[#252422] border border-[#2e2c29] rounded-xl flex flex-col justify-between hover:border-[#45433f] transition-all group"
                      aria-labelledby={`card-title-${win.id}`}
                    >
                      <div className="space-y-3.5">
                        {/* Header: Account & Service path + Badges */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-[#898580] font-mono truncate">
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
                              className="text-base font-semibold text-[#FBFAF9] truncate font-mono"
                            >
                              {win.name}
                            </h2>
                            <span className="text-[11px] font-mono text-[#FF6542] bg-[#181818] px-2 py-0.5 rounded border border-[#2e2c29] shrink-0">
                              {win.cadence}
                            </span>
                          </div>

                          <div className="text-[11px] text-[#898580] font-mono">
                            Service: <span className="text-[#FBFAF9]">{service ? service.name : 'Custom'}</span>
                          </div>
                        </div>

                        {/* Progress Bar & Numeric Labels */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-[#FBFAF9] font-medium">
                              {formatNumber(win.currentUsed)} / {formatNumber(win.capacity)} {unitDisplay}
                            </span>
                            <span className="font-semibold text-[#898580]">
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

                          <div className="flex items-center justify-between text-[11px] text-[#898580] font-mono pt-0.5">
                            <span>Remaining:</span>
                            <span className={remaining <= 0 ? 'text-[#ef4444] font-semibold' : 'text-[#10b981] font-semibold'}>
                              {formatNumber(remaining)} {unitDisplay}
                            </span>
                          </div>
                        </div>

                        {/* Timing and Reset Info */}
                        <div className="p-2.5 bg-[#181818] border border-[#2e2c29] rounded-lg text-[11px] font-mono space-y-1.5 text-[#898580]">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <RotateCcw className="w-3 h-3 text-[#FF6542]" />
                              <span>Next Reset:</span>
                            </span>
                            <span
                              className={`font-semibold ${
                                resetResult.isPastDue
                                  ? 'text-[#ef4444]'
                                  : 'text-[#FBFAF9]'
                              }`}
                            >
                              {resetResult.isPastDue ? 'Past Due (advancing)' : `in ${countdown}`}
                            </span>
                          </div>

                          <div className="text-[10px] text-[#66635f] truncate" title={resetFormatted}>
                            {resetFormatted} ({win.timeZone})
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-[#252422] text-[10px]">
                            <span>Last Updated:</span>
                            <span className="text-[#898580]" title={win.lastUpdated}>
                              {formatRelativeTime(win.lastUpdated)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-4 mt-2 border-t border-[#2e2c29]">
                        <button
                          onClick={() => onOpenLogUsage(win.id)}
                          className="btn-dark-solid text-[11px] justify-center h-8"
                          title="Log usage for this window"
                        >
                          <Plus className="w-3 h-3 text-[#FF6542]" />
                          <span>Log Usage</span>
                        </button>
                        <button
                          onClick={() => onOpenCorrectBalance(win.id)}
                          className="btn-secondary-square text-[11px] justify-center h-8"
                          title="Calibrate balance to match provider console"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Correct</span>
                        </button>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* Cream Editorial Founder / Owner Note Card */}
        <section
          aria-label="Owner Advisory Card"
          className="founder-note-card relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#FF6542] font-bold">
                  Operational Architecture
                </span>
                <span className="script-note text-xs">manual calibration guide</span>
              </div>
              <h3 className="text-xl font-bold text-[#0C0B09]">
                Manual Estimates & Reset Anchor Precision
              </h3>
              <p className="text-[#353431] text-xs leading-relaxed font-mono">
                Quota Ember runs locally without credentials, background token sniffers, or secret provider API keys.
                All figures represent your logged usage and manual balance corrections. Reset schedules strictly follow your configured
                anchors: hourly intervals count from the minute of the hour, daily windows advance at your local wall-clock hour,
                and monthly cadences automatically clamp to month-ends (e.g. 31st to 28th/30th) across Daylight Saving transitions.
              </p>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="inline-block px-3 py-1.5 rounded-full bg-[#0C0B09] text-[#FBFAF9] text-xs font-mono font-medium">
                100% Client-Side Local
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
