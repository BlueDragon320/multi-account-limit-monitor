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
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="window-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-window max-w-lg p-6 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] text-[#E7E5E4]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[#D4F268]">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 id="window-modal-title" className="text-sm font-semibold text-[#E7E5E4]">
                {windowItem ? 'Edit Limit Window' : 'Add Limit Window'}
              </h3>
              <p className="text-[11px] text-[#A8A29E] font-mono">
                Service: <span className="text-[#E7E5E4] font-medium">{serviceName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#A8A29E] hover:text-[#E7E5E4] bg-transparent border-0 cursor-pointer p-1 rounded hover:bg-[rgba(255,255,255,0.1)]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] text-xs font-mono">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="win-name" className="label-text">
              Window Name <span className="text-[#D4F268]">*</span>
            </label>
            <input
              id="win-name"
              type="text"
              className="input-control"
              placeholder="e.g., Hourly Burst, Weekly Quota, Daily Prompts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="win-cap" className="label-text">
                Capacity <span className="text-[#D4F268]">*</span>
              </label>
              <input
                id="win-cap"
                type="number"
                min="0.001"
                step="any"
                className="input-control"
                value={capacity}
                onChange={(e) => setCapacity(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div>
              <label htmlFor="win-unit" className="label-text">
                Unit
              </label>
              <select
                id="win-unit"
                className="input-control"
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
              <label htmlFor="win-custom-unit" className="label-text">
                Custom Unit Name <span className="text-[#D4F268]">*</span>
              </label>
              <input
                id="win-custom-unit"
                type="text"
                className="input-control"
                placeholder="e.g., tokens, transactions, calls"
                value={customUnitName}
                onChange={(e) => setCustomUnitName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="win-cadence" className="label-text">
                Reset Cadence
              </label>
              <select
                id="win-cadence"
                className="input-control"
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
                <label htmlFor="win-interval" className="label-text">
                  Interval Hours <span className="text-[#D4F268]">*</span>
                </label>
                <input
                  id="win-interval"
                  type="number"
                  min="1"
                  className="input-control"
                  value={customIntervalHours}
                  onChange={(e) => setCustomIntervalHours(parseInt(e.target.value, 10) || 1)}
                  required
                />
              </div>
            ) : (
              <div>
                <label htmlFor="win-anchor" className="label-text">
                  Reset Anchor
                </label>
                <input
                  id="win-anchor"
                  type="datetime-local"
                  className="input-control"
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
            <label htmlFor="win-tz" className="label-text">
              Time Zone
            </label>
            <select
              id="win-tz"
              className="input-control"
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
            <p className="text-[10px] text-[#A8A29E] mt-1 font-mono">
              Wall-clock time and DST transitions will be preserved in this zone.
            </p>
          </div>

          {windowItem && (
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-[#E7E5E4]">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                  className="rounded bg-[#0C0A09] border-[rgba(255,255,255,0.1)] text-[#D4F268]"
                />
                <span>Archive this window (hides from overview calculations)</span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(255,255,255,0.1)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-dark-solid text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-cream text-xs font-semibold"
            >
              {windowItem ? 'Save Window' : 'Create Window'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
