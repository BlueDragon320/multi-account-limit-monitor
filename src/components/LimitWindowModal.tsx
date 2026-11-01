import React, { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { LimitWindow, CadenceType, UnitType } from '../domain/types';
import { toLocalDatetimeInputValue } from '../utils/formatters';

interface LimitWindowModalProps {
  isOpen: boolean;
  serviceId: string;
  accountId: string;
  serviceName: string;
  windowItem?: LimitWindow | null; // if provided, editing mode
  defaultTimeZone: string;
  onSave: (data: {
    serviceId: string;
    accountId: string;
    name: string;
    capacity: number;
    unit: UnitType;
    customUnitName?: string;
    cadence: CadenceType;
    customIntervalHours?: number;
    resetAnchor: string;
    timeZone: string;
    archived?: boolean;
  }) => void;
  onClose: () => void;
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

export const LimitWindowModal: React.FC<LimitWindowModalProps> = ({
  isOpen,
  serviceId,
  accountId,
  serviceName,
  windowItem,
  defaultTimeZone,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(() => (windowItem ? windowItem.name : ''));
  const [capacity, setCapacity] = useState(() => (windowItem ? windowItem.capacity : 100));
  const [unit, setUnit] = useState<UnitType>(() => (windowItem ? windowItem.unit : 'requests'));
  const [customUnitName, setCustomUnitName] = useState(() => (windowItem ? windowItem.customUnitName || '' : ''));
  const [cadence, setCadence] = useState<CadenceType>(() => (windowItem ? windowItem.cadence : 'daily'));
  const [customIntervalHours, setCustomIntervalHours] = useState(() => (windowItem ? windowItem.customIntervalHours || 12 : 12));
  const [resetAnchor, setResetAnchor] = useState(() => (windowItem ? windowItem.resetAnchor : new Date().toISOString()));
  const [timeZone, setTimeZone] = useState(() => (windowItem ? windowItem.timeZone : defaultTimeZone || 'UTC'));
  const [archived, setArchived] = useState(() => (windowItem ? windowItem.archived : false));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (windowItem) {
      setName(windowItem.name);
      setCapacity(windowItem.capacity);
      setUnit(windowItem.unit);
      setCustomUnitName(windowItem.customUnitName || '');
      setCadence(windowItem.cadence);
      setCustomIntervalHours(windowItem.customIntervalHours || 12);
      setResetAnchor(windowItem.resetAnchor);
      setTimeZone(windowItem.timeZone);
      setArchived(windowItem.archived);
    } else {
      setName('');
      setCapacity(100);
      setUnit('requests');
      setCustomUnitName('');
      setCadence('daily');
      setCustomIntervalHours(12);
      setResetAnchor(new Date().toISOString());
      setTimeZone(defaultTimeZone || 'UTC');
      setArchived(false);
    }
    setError(null);
  }, [isOpen, windowItem, defaultTimeZone]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Window name is required.');
      return;
    }
    if (capacity <= 0 || isNaN(capacity)) {
      setError('Capacity must be greater than zero.');
      return;
    }
    if (unit === 'custom' && !customUnitName.trim()) {
      setError('Please provide a name for the custom unit.');
      return;
    }
    if (cadence === 'custom' && (!customIntervalHours || customIntervalHours <= 0)) {
      setError('Custom interval hours must be greater than zero.');
      return;
    }

    onSave({
      serviceId,
      accountId,
      name: trimmedName,
      capacity,
      unit,
      customUnitName: unit === 'custom' ? customUnitName.trim() : undefined,
      cadence,
      customIntervalHours: cadence === 'custom' ? customIntervalHours : undefined,
      resetAnchor,
      timeZone,
      archived,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-[#0C0A09]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="window-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1917] border border-[rgba(255,255,255,0.12)] rounded-[24px] p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] text-[#E7E5E4]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 mb-6 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[#D4F268]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 id="window-modal-title" className="font-serif font-light text-2xl text-[#E7E5E4] tracking-tight">
                {windowItem ? 'Edit Limit Window' : 'Add Limit Window'}
              </h2>
              <p className="text-xs text-[#A8A29E] font-sans mt-0.5">
                Service: <span className="text-[#E7E5E4] font-medium">{serviceName}</span>
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
            <div className="p-3 rounded-xl bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.3)] text-[#f87171] text-xs font-mono">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="win-name" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Window Name <span className="text-[#D4F268]">*</span>
            </label>
            <input
              id="win-name"
              type="text"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
              placeholder="e.g., Hourly Burst, Weekly Quota, Daily Prompts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="win-cap" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Capacity <span className="text-[#D4F268]">*</span>
              </label>
              <input
                id="win-cap"
                type="number"
                min="0.001"
                step="any"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                value={capacity}
                onChange={(e) => setCapacity(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div>
              <label htmlFor="win-unit" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Unit
              </label>
              <select
                id="win-unit"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
                value={unit}
                onChange={(e) => setUnit(e.target.value as UnitType)}
              >
                <option value="requests">requests</option>
                <option value="credits">credits</option>
                <option value="percent">percent</option>
                <option value="custom">custom unit</option>
              </select>
            </div>
          </div>

          {unit === 'custom' && (
            <div>
              <label htmlFor="win-custom-unit" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Custom Unit Name <span className="text-[#D4F268]">*</span>
              </label>
              <input
                id="win-custom-unit"
                type="text"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                placeholder="e.g., tokens, transactions, calls"
                value={customUnitName}
                onChange={(e) => setCustomUnitName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="win-cadence" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                Reset Cadence
              </label>
              <select
                id="win-cadence"
                className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as CadenceType)}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom (Hours)</option>
              </select>
            </div>

            {cadence === 'custom' ? (
              <div>
                <label htmlFor="win-interval" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                  Interval Hours <span className="text-[#D4F268]">*</span>
                </label>
                <input
                  id="win-interval"
                  type="number"
                  min="1"
                  className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                  value={customIntervalHours}
                  onChange={(e) => setCustomIntervalHours(parseInt(e.target.value, 10) || 1)}
                  required
                />
              </div>
            ) : (
              <div>
                <label htmlFor="win-anchor" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
                  Reset Anchor
                </label>
                <input
                  id="win-anchor"
                  type="datetime-local"
                  className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                  value={toLocalDatetimeInputValue(new Date(resetAnchor))}
                  onChange={(e) => {
                    const dt = new Date(e.target.value);
                    if (!isNaN(dt.getTime())) {
                      setResetAnchor(dt.toISOString());
                    }
                  }}
                  required
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="win-tz" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Time Zone
            </label>
            <select
              id="win-tz"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
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
            <p className="text-[11px] text-[#A8A29E] mt-1.5 font-mono">
              Wall-clock time and DST transitions will be preserved in this zone.
            </p>
          </div>

          {windowItem && (
            <div className="p-3 bg-[#141210] rounded-xl border border-[rgba(255,255,255,0.08)]">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-mono text-[#E7E5E4]">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#0C0A09] border border-[rgba(255,255,255,0.2)] text-[#D4F268] accent-[#D4F268] focus:ring-0 cursor-pointer"
                />
                <span>Archive this window (hides from overview calculations)</span>
              </label>
            </div>
          )}

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
            >
              {windowItem ? 'Save Window' : 'Create Window'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
