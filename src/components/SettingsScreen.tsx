import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { AppState, UserSettings } from '../domain/types';
import { downloadJsonBackup, validateImportJson, generateImportDiff, ValidationResult, ImportDiff } from '../storage/exportImport';
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
  const { settings } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [timeZone, setTimeZone] = useState(settings.defaultTimeZone || getSystemTimeZone());
  const [lowCapThreshold, setLowCapThreshold] = useState(settings.lowCapacityThresholdPercent ?? 80);
  const [staleHours, setStaleHours] = useState(settings.staleDataThresholdHours ?? 24);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Detect user local system timezone
  const handleDetectLocalTz = () => {
    const detected = getSystemTimeZone();
    setTimeZone(detected);
    onUpdateSettings({ defaultTimeZone: detected });
    showSaveNotification();
  };

  const showSaveNotification = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
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
    <div className="max-w-[1000px] mx-auto px-4 py-6 space-y-8 font-mono">
      {/* Header */}
      <div className="border-b border-[#2e2c29] pb-4">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#FBFAF9]">
          Settings & Local Data Management
        </h1>
        <p className="text-xs text-[#898580] mt-0.5">
          Configure cadence defaults, alert thresholds, and manage versioned JSON state snapshots.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)] text-[#10b981] rounded-lg text-xs flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      {importError && (
        <div className="p-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{importError}</span>
        </div>
      )}

      {/* Form: Thresholds & Timezone */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Time Zone Settings */}
        <section className="card-panel p-5 bg-[#201f1d] border border-[#2e2c29] rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-[#252422] pb-2">
            <Globe className="w-4 h-4 text-[#FF6542]" />
            <h2 className="text-sm font-semibold text-[#FBFAF9]">Default Time Zone</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label htmlFor="settings-tz" className="label-text">
                Primary Cadence Reference Zone
              </label>
              <select
                id="settings-tz"
                className="input-control text-xs"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
              >
                {COMMON_TIMEZONES.includes(timeZone) ? null : (
                  <option value={timeZone}>{timeZone}</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#898580] mt-1">
                Applied as default for new services and windows. Reset anchors maintain wall-clock fidelity.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={handleDetectLocalTz}
                className="btn-dark-solid text-xs w-full h-[34px] justify-center"
              >
                <span>Detect Local ({getSystemTimeZone()})</span>
              </button>
            </div>
          </div>
        </section>

        {/* Alert Thresholds */}
        <section className="card-panel p-5 bg-[#201f1d] border border-[#2e2c29] rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-[#252422] pb-2">
            <Sliders className="w-4 h-4 text-[#FF6542]" />
            <h2 className="text-sm font-semibold text-[#FBFAF9]">Health & Warning Thresholds</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Low capacity */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="low-cap" className="label-text mb-0">
                  Low Capacity Alert Trigger
                </label>
                <span className="text-xs font-semibold text-[#FF6542]">{lowCapThreshold}%</span>
              </div>
              <input
                id="low-cap"
                type="range"
                min="50"
                max="95"
                step="5"
                value={lowCapThreshold}
                onChange={(e) => setLowCapThreshold(Number(e.target.value))}
                className="w-full accent-[#FF6542] cursor-pointer"
              />
              <p className="text-[10px] text-[#898580] mt-1">
                Flags limit windows when used capacity reaches or exceeds {lowCapThreshold}% (i.e. &le;{100 - lowCapThreshold}% remaining).
              </p>
            </div>

            {/* Stale data */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="stale-hrs" className="label-text mb-0">
                  Stale Data Threshold (Hours)
                </label>
                <span className="text-xs font-semibold text-[#f59e0b]">{staleHours}h</span>
              </div>
              <input
                id="stale-hrs"
                type="number"
                min="1"
                max="168"
                step="1"
                value={staleHours}
                onChange={(e) => setStaleHours(Number(e.target.value))}
                className="input-control text-xs"
              />
              <p className="text-[10px] text-[#898580] mt-1">
                Flags windows that have not received an update or balance check in over {staleHours} hours.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="btn-primary-cream text-xs font-semibold"
            >
              Save Preferences
            </button>
          </div>
        </section>
      </form>

      {/* JSON Backup & Restore */}
      <section className="card-panel p-5 bg-[#201f1d] border border-[#2e2c29] rounded-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-[#252422] pb-2">
          <Database className="w-4 h-4 text-[#FF6542]" />
          <h2 className="text-sm font-semibold text-[#FBFAF9]">State Backup & Migration</h2>
        </div>

        <p className="text-xs text-[#898580] leading-relaxed">
          Export your complete accounts, limit windows, projects, and history into a validated JSON snapshot.
          Restoring allows transferring your configuration across browsers or reverting to previous points in time.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="btn-dark-solid text-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#FF6542]" />
            <span>Export Backup (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary-square text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
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

      {/* Browser Storage Advisory Notice */}
      <section className="card-panel-deep p-5 border border-[#2e2c29] rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-[#f59e0b]">
          <ShieldAlert className="w-4 h-4" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Browser Storage & Privacy Architecture
          </h3>
        </div>

        <div className="text-xs text-[#898580] space-y-2 leading-relaxed">
          <p>
            Quota Ember stores 100% of its data in client-side <span className="text-[#FBFAF9]">localStorage</span> within this specific browser profile.
            No data is transmitted to remote cloud databases, telemetry analytics, or third-party servers.
          </p>
          <p className="text-[11px] text-[#66635f]">
            Notice: If you clear your browser site data or cookies, or use an incognito session, this local state may be erased.
            We strongly advise periodically downloading an exported JSON backup to keep safe copies of your records.
          </p>
        </div>

        <div className="pt-3 border-t border-[#252422] flex items-center justify-between">
          <span className="text-[11px] text-[#ef4444]">
            Destructive: Wipe all local state
          </span>
          <button
            type="button"
            onClick={onRequestClearAll}
            className="btn-danger text-xs h-7 px-3"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear All Local Data</span>
          </button>
        </div>
      </section>
    </div>
  );
};
