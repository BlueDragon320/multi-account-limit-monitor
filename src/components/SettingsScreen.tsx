import React, { useState, useRef, useMemo } from 'react';
import {
  Sliders,
  Globe,
  AlertTriangle,
  Download,
  Upload,
  Database,
  Trash2,
  Check,
  ShieldAlert,
  Search,
  HardDrive,
} from 'lucide-react';
import { AppState, UserSettings } from '../domain/types';
import {
  downloadJsonBackup,
  validateImportJson,
  generateImportDiff,
  ValidationResult,
  ImportDiff,
} from '../storage/exportImport';
import { getSystemTimeZone } from '../storage/storage';

interface SettingsScreenProps {
  state: AppState;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  onTriggerImportModal: (validation: ValidationResult, diff: ImportDiff) => void;
  onRequestClearAll: () => void;
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Australia/Sydney',
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  state,
  onUpdateSettings,
  onTriggerImportModal,
  onRequestClearAll,
}) => {
  const { settings, accounts, services, limitWindows, projects, usageEvents } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectedSystemTz = useMemo(() => getSystemTimeZone(), []);
  const [timeZone, setTimeZone] = useState(settings.defaultTimeZone || detectedSystemTz);
  const [tzSearchQuery, setTzSearchQuery] = useState('');
  const [lowCapThreshold, setLowCapThreshold] = useState(settings.lowCapacityThresholdPercent ?? 80);
  const [staleHours, setStaleHours] = useState(settings.staleDataThresholdHours ?? 24);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Storage metric statistics
  const storageMetrics = useMemo(() => {
    let payloadBytes = 0;
    try {
      const serialized = JSON.stringify(state);
      payloadBytes = new TextEncoder().encode(serialized).length;
    } catch {
      payloadBytes = 0;
    }

    const payloadKb = (payloadBytes / 1024).toFixed(1);
    const activeAccountsCount = accounts.filter((a) => !a.archived).length;
    const archivedAccountsCount = accounts.filter((a) => a.archived).length;
    const activeWindowsCount = limitWindows.filter((w) => !w.archived).length;

    return {
      payloadBytes,
      payloadKb,
      accountsTotal: accounts.length,
      activeAccountsCount,
      archivedAccountsCount,
      servicesTotal: services.length,
      windowsTotal: limitWindows.length,
      activeWindowsCount,
      projectsTotal: projects.length,
      eventsTotal: usageEvents.length,
    };
  }, [state, accounts, services, limitWindows, projects, usageEvents]);

  // Filtered timezones based on search query
  const filteredTimezones = useMemo(() => {
    const list = [...COMMON_TIMEZONES];
    if (timeZone && !list.includes(timeZone)) {
      list.unshift(timeZone);
    }
    if (detectedSystemTz && !list.includes(detectedSystemTz)) {
      list.push(detectedSystemTz);
    }
    if (!tzSearchQuery.trim()) return list;
    const q = tzSearchQuery.toLowerCase();
    return list.filter((tz) => tz.toLowerCase().includes(q));
  }, [timeZone, detectedSystemTz, tzSearchQuery]);

  // Detect user local system timezone
  const handleDetectLocalTz = () => {
    const detected = getSystemTimeZone();
    setTimeZone(detected);
    onUpdateSettings({ defaultTimeZone: detected });
    showSaveNotification();
  };

  const showSaveNotification = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2200);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      defaultTimeZone: timeZone,
      lowCapacityThresholdPercent: Number(lowCapThreshold),
      staleDataThresholdHours: Number(staleHours),
    });
    showSaveNotification();
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    downloadJsonBackup(state);
  };

  // Import JSON Backup
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const validation = validateImportJson(text);

        if (!validation.valid || !validation.summary) {
          setImportError(validation.error || 'Validation failed');
          return;
        }

        const diff = generateImportDiff(state, validation.summary);
        onTriggerImportModal(validation, diff);
      } catch (err: any) {
        setImportError(`Failed to parse backup file: ${err.message || 'Unknown error'}`);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.1)] pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1C1917] border border-[rgba(255,255,255,0.1)] text-[11px] font-mono text-[#A8A29E] mb-2">
          <span className="w-2 h-2 rounded-full bg-[#D4F268] shadow-[0_0_8px_#D4F268]" />
          <span className="tech-tag text-[#E7E5E4]">Fig. 04 • System Engine & Local Sandbox</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-[#E7E5E4]">
          Settings & <em>Local Data Management</em>
        </h1>
        <p className="text-sm text-[#A8A29E] mt-1 font-sans max-w-xl">
          Configure cadence defaults, alert thresholds, and manage versioned JSON state snapshots.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-[rgba(212,242,104,0.12)] border border-[rgba(212,242,104,0.3)] text-[#D4F268] rounded-[20px] text-xs font-mono flex items-center gap-2.5 shadow-[0_0_16px_rgba(212,242,104,0.15)] animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-[#D4F268] shrink-0" />
          <span>System configuration and threshold preferences updated successfully.</span>
        </div>
      )}

      {importError && (
        <div className="p-4 bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.3)] text-[#f87171] rounded-[20px] text-xs font-mono flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{importError}</span>
        </div>
      )}

      {/* STORAGE METRICS CARD */}
      <section aria-label="Storage Metrics" className="card-panel p-6 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-[#D4F268]">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#E7E5E4] font-mono">
                Storage Metrics & Client-Side Sandbox Health
              </h2>
              <p className="text-[11px] text-[#A8A29E]">
                100% client-resident state • Zero server telemetry
              </p>
            </div>
          </div>

          <div className="badge badge-lime text-[10px] flex items-center gap-1.5 self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4F268] shadow-[0_0_6px_#D4F268] animate-pulse" />
            <span>Optimal • Local Storage Active</span>
          </div>
        </div>

        {/* Item Count Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-[16px] font-mono">
            <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider block">Accounts</span>
            <span className="text-2xl font-light text-[#E7E5E4] mt-1 block">
              {storageMetrics.accountsTotal}
            </span>
            <span className="text-[10px] text-[#78716C]">
              {storageMetrics.activeAccountsCount} active
            </span>
          </div>

          <div className="p-3.5 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-[16px] font-mono">
            <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider block">Services</span>
            <span className="text-2xl font-light text-[#E7E5E4] mt-1 block">
              {storageMetrics.servicesTotal}
            </span>
            <span className="text-[10px] text-[#78716C]">Attached tiers</span>
          </div>

          <div className="p-3.5 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-[16px] font-mono">
            <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider block">Windows</span>
            <span className="text-2xl font-light text-[#D4F268] mt-1 block">
              {storageMetrics.windowsTotal}
            </span>
            <span className="text-[10px] text-[#78716C]">
              {storageMetrics.activeWindowsCount} active
            </span>
          </div>

          <div className="p-3.5 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-[16px] font-mono">
            <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider block">Projects</span>
            <span className="text-2xl font-light text-[#E7E5E4] mt-1 block">
              {storageMetrics.projectsTotal}
            </span>
            <span className="text-[10px] text-[#78716C]">Attributions</span>
          </div>

          <div className="p-3.5 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-[16px] font-mono">
            <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider block">Ledger Logs</span>
            <span className="text-2xl font-light text-[#E7E5E4] mt-1 block">
              {storageMetrics.eventsTotal}
            </span>
            <span className="text-[10px] text-[#78716C]">Events recorded</span>
          </div>

          <div className="p-3.5 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-[16px] font-mono">
            <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider block">Storage Size</span>
            <span className="text-2xl font-light text-[#D4F268] mt-1 block">
              {storageMetrics.payloadKb}
              <span className="text-xs font-normal text-[#E7E5E4] ml-0.5">KB</span>
            </span>
            <span className="text-[10px] text-[#78716C]">
              {storageMetrics.payloadBytes} bytes
            </span>
          </div>
        </div>
      </section>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-8">
        {/* TIME ZONE SELECTOR SECTION */}
        <section className="card-panel p-6 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-[#D4F268]">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#E7E5E4] font-mono">
                  Default Time Zone
                </h2>
                <p className="text-xs text-[#A8A29E]">
                  Cadence reference zone for calendar alignment and wall-clock resets
                </p>
              </div>
            </div>

            {/* Detected Local Timezone Badge Pill */}
            <button
              type="button"
              onClick={handleDetectLocalTz}
              className="btn-dark-solid text-xs h-8 px-3.5 rounded-full flex items-center gap-2 hover:border-[#D4F268] transition-all self-start sm:self-auto font-mono cursor-pointer"
              title="Click to switch to detected system timezone"
            >
              <Globe className="w-3.5 h-3.5 text-[#D4F268]" />
              <span>Detected Local:</span>
              <span className="text-[#D4F268] font-semibold">{detectedSystemTz}</span>
            </button>
          </div>

          <div className="space-y-3">
            <label htmlFor="settings-tz" className="label-text text-xs font-mono uppercase tracking-wider text-[#A8A29E] block">
              Primary Cadence Reference Zone
            </label>

            {/* Search Filter for Timezones */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div className="sm:col-span-2">
                <select
                  id="settings-tz"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-full px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-[#D4F268] cursor-pointer w-full transition-colors"
                >
                  {filteredTimezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz} {tz === detectedSystemTz ? '(System Local)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter zone..."
                  value={tzSearchQuery}
                  onChange={(e) => setTzSearchQuery(e.target.value)}
                  className="bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-full pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-[#D4F268] w-full"
                />
              </div>
            </div>

            <p className="text-[11px] text-[#A8A29E] leading-relaxed">
              Applied automatically as the reference timezone for newly created limit windows. Existing windows retain their explicitly assigned timezone to ensure multi-region operational accuracy.
            </p>
          </div>
        </section>

        {/* THRESHOLD SLIDERS SECTION */}
        <section className="card-panel p-6 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] space-y-6">
          <div className="flex items-center gap-2.5 border-b border-[rgba(255,255,255,0.06)] pb-4">
            <div className="w-8 h-8 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-[#D4F268]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#E7E5E4] font-mono">
                Health & Warning Thresholds
              </h2>
              <p className="text-xs text-[#A8A29E]">
                Dynamic trigger boundaries for low-capacity alerts and stale-data flags
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Low Capacity Threshold Slider */}
            <div className="p-5 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-[20px] space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <label htmlFor="low-cap" className="label-text mb-0 text-xs font-mono uppercase tracking-wider text-[#A8A29E]">
                    Low Capacity Alert Trigger
                  </label>
                  <p className="text-[11px] text-[#78716C] mt-0.5">
                    Warns when quota consumption crosses threshold
                  </p>
                </div>
                {/* Large Monospace Value Display */}
                <div className="text-3xl font-mono font-light text-[#D4F268] tracking-tight shrink-0">
                  {lowCapThreshold}
                  <span className="text-base font-normal text-[#E7E5E4] ml-0.5">%</span>
                </div>
              </div>

              {/* Custom Dark Range Slider Track & Thumb */}
              <div className="pt-2">
                <input
                  id="low-cap"
                  type="range"
                  min="50"
                  max="95"
                  step="1"
                  value={lowCapThreshold}
                  onChange={(e) => setLowCapThreshold(Number(e.target.value))}
                  className="range-slider-dark"
                />
              </div>

              {/* Slider Scale Ticks */}
              <div className="flex items-center justify-between text-[10px] text-[#78716C] font-mono pt-1">
                <span>50%</span>
                <span>70%</span>
                <span className="text-[#D4F268] font-medium">80% (Default)</span>
                <span>90%</span>
                <span>95%</span>
              </div>

              <p className="text-[11px] text-[#A8A29E] pt-1">
                Flags windows when used capacity reaches or exceeds {lowCapThreshold}% (i.e. &le;{100 - lowCapThreshold}% remaining).
              </p>
            </div>

            {/* Stale Data Threshold Slider */}
            <div className="p-5 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-[20px] space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <label htmlFor="stale-hrs" className="label-text mb-0 text-xs font-mono uppercase tracking-wider text-[#A8A29E]">
                    Stale Data Threshold (Hours)
                  </label>
                  <p className="text-[11px] text-[#78716C] mt-0.5">
                    Warns when no telemetry has been logged
                  </p>
                </div>
                {/* Large Monospace Value Display */}
                <div className="text-3xl font-mono font-light text-[#fbbf24] tracking-tight shrink-0">
                  {staleHours}
                  <span className="text-base font-normal text-[#E7E5E4] ml-0.5">h</span>
                </div>
              </div>

              {/* Custom Dark/Amber Range Slider Track & Thumb */}
              <div className="pt-2">
                <input
                  id="stale-hrs"
                  type="range"
                  min="1"
                  max="168"
                  step="1"
                  value={staleHours}
                  onChange={(e) => setStaleHours(Number(e.target.value))}
                  className="range-slider-amber"
                />
              </div>

              {/* Slider Scale Ticks */}
              <div className="flex items-center justify-between text-[10px] text-[#78716C] font-mono pt-1">
                <span>1h</span>
                <span>12h</span>
                <span className="text-[#fbbf24] font-medium">24h (1d)</span>
                <span>72h (3d)</span>
                <span>168h (7d)</span>
              </div>

              <p className="text-[11px] text-[#A8A29E] pt-1">
                Flags windows that have not received an update or balance check in over {staleHours} hours.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="btn-primary-lime text-xs font-semibold px-6 h-9 rounded-full cursor-pointer shadow-[0_2px_12px_rgba(212,242,104,0.25)]"
            >
              Save Preferences
            </button>
          </div>
        </section>
      </form>

      {/* STATE BACKUP & MIGRATION */}
      <section aria-label="Backup and Data Management" className="card-panel p-6 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] space-y-5">
        <div className="flex items-center gap-2.5 border-b border-[rgba(255,255,255,0.06)] pb-4">
          <div className="w-8 h-8 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-[#D4F268]">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#E7E5E4] font-mono">
              State Backup & Migration
            </h2>
            <p className="text-xs text-[#A8A29E]">
              Zero-credential portable snapshots with schema verification
            </p>
          </div>
        </div>

        <p className="text-xs text-[#A8A29E] leading-relaxed">
          Export your complete accounts, limit windows, projects, and history into a validated JSON snapshot.
          Restoring allows transferring your configuration across browsers or reverting to previous points in time.
        </p>

        {/* Action Buttons: Solid Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="btn-primary-lime text-xs h-9 px-5 rounded-full flex items-center gap-2 cursor-pointer shadow-[0_2px_12px_rgba(212,242,104,0.2)]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-dark-solid text-xs h-9 px-5 rounded-full flex items-center gap-2 hover:border-[#D4F268] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#D4F268]" />
            <span>Import Backup...</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFileChange}
            className="hidden"
          />
        </div>
      </section>

      {/* BROWSER STORAGE & PRIVACY ARCHITECTURE */}
      <section aria-label="Browser Storage Advisory" className="card-panel-deep p-6 bg-[#141210] border border-[rgba(255,255,255,0.1)] rounded-[24px] space-y-4">
        <div className="flex items-center gap-2.5 text-[#fbbf24]">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <h3 className="text-xs font-semibold uppercase tracking-wider font-mono">
            Browser Storage & Privacy Architecture
          </h3>
        </div>

        <div className="text-xs text-[#A8A29E] space-y-2.5 leading-relaxed font-sans">
          <p>
            Quota Ember stores 100% of its data in client-side{' '}
            <span className="text-[#E7E5E4] font-mono font-medium">localStorage</span> within this
            specific browser profile. No data is transmitted to remote cloud databases, telemetry analytics, or third-party servers.
          </p>
          <p className="text-[11px] text-[#78716C] leading-relaxed">
            Notice: If you clear your browser site data or cookies, or use an incognito session, this local state may be erased.
            We strongly advise periodically downloading an exported JSON backup to keep safe copies of your records.
          </p>
        </div>

        {/* Destructive Clear Action */}
        <div className="pt-4 border-t border-[rgba(255,255,255,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-[11px] text-[#f87171] font-mono">
            Destructive: Wipe all local accounts, windows, and history
          </span>
          <button
            type="button"
            onClick={onRequestClearAll}
            className="btn-danger text-xs h-8 px-4 rounded-full flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Local Data</span>
          </button>
        </div>
      </section>
    </div>
  );
};
