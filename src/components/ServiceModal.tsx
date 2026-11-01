import React, { useState, useEffect } from 'react';
import { X, Server, Sparkles, Plus, Trash2 } from 'lucide-react';
import { Account, Service, CadenceType, UnitType } from '../domain/types';
import { SERVICE_PRESETS, getPresetByName } from '../domain/presets';
import { toLocalDatetimeInputValue } from '../utils/formatters';

interface WindowDraft {
  name: string;
  capacity: number;
  unit: UnitType;
  customUnitName?: string;
  cadence: CadenceType;
  customIntervalHours?: number;
  resetAnchor: string;
  timeZone: string;
}

interface ServiceModalProps {
  isOpen: boolean;
  accounts: Account[];
  selectedAccountId?: string;
  service?: Service | null; // if provided, editing mode
  defaultTimeZone: string;
  onSave: (data: {
    accountId: string;
    name: string;
    notes?: string;
    archived?: boolean;
    windows?: WindowDraft[];
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

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  accounts,
  selectedAccountId,
  service,
  defaultTimeZone,
  onSave,
  onClose,
}) => {
  const [accountId, setAccountId] = useState(() => {
    if (service) return service.accountId;
    return selectedAccountId || (accounts.length > 0 ? accounts[0].id : '');
  });
  const [name, setName] = useState(() => {
    if (service) return service.name;
    const preset = getPresetByName('Antigravity');
    return preset ? preset.name : 'Antigravity';
  });
  const [notes, setNotes] = useState(() => (service ? service.notes || '' : ''));
  const [archived, setArchived] = useState(() => (service ? service.archived : false));
  const [selectedPresetName, setSelectedPresetName] = useState<string>(() => (service ? '' : 'Antigravity'));
  const [windows, setWindows] = useState<WindowDraft[]>(() => {
    if (service) return [];
    const preset = getPresetByName('Antigravity');
    if (!preset) return [];
    const nowIso = new Date().toISOString();
    return preset.suggestedWindows.map((sw) => ({
      name: sw.name,
      capacity: sw.defaultCapacity ?? 100,
      unit: sw.unit,
      cadence: sw.cadence,
      resetAnchor: nowIso,
      timeZone: defaultTimeZone || 'UTC',
    }));
  });
  const [error, setError] = useState<string | null>(null);

  // Sync state if service/accounts/isOpen change
  useEffect(() => {
    if (!isOpen) return;

    if (service) {
      setAccountId(service.accountId);
      setName(service.name);
      setNotes(service.notes || '');
      setArchived(service.archived);
      setWindows([]);
      setSelectedPresetName('');
    } else {
      const initialAccId = selectedAccountId || (accounts.length > 0 ? accounts[0].id : '');
      setAccountId(initialAccId);
      setNotes('');
      setArchived(false);
      setError(null);
      applyPreset('Antigravity', defaultTimeZone);
    }
  }, [isOpen, service, selectedAccountId, accounts, defaultTimeZone]);

  const applyPreset = (presetName: string, tz: string) => {
    setSelectedPresetName(presetName);
    const preset = getPresetByName(presetName);
    if (!preset) return;

    setName(preset.name);
    const nowIso = new Date().toISOString();
    const newDrafts: WindowDraft[] = preset.suggestedWindows.map((sw) => ({
      name: sw.name,
      capacity: sw.defaultCapacity ?? 100,
      unit: sw.unit,
      cadence: sw.cadence,
      resetAnchor: nowIso,
      timeZone: tz || 'UTC',
    }));
    setWindows(newDrafts);
  };

  if (!isOpen) return null;

  const handleAddCustomWindow = () => {
    setWindows((prev) => [
      ...prev,
      {
        name: `Window ${prev.length + 1}`,
        capacity: 100,
        unit: 'requests',
        cadence: 'daily',
        resetAnchor: new Date().toISOString(),
        timeZone: defaultTimeZone || 'UTC',
      },
    ]);
  };

  const handleRemoveWindow = (index: number) => {
    setWindows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleWindowChange = (index: number, updates: Partial<WindowDraft>) => {
    setWindows((prev) =>
      prev.map((w, i) => (i === index ? { ...w, ...updates } : w))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      setError('Please select an account.');
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Service name is required.');
      return;
    }

    if (!service && windows.length === 0) {
      setError('Please configure at least one limit window for this service.');
      return;
    }

    // Validate windows
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      if (!w.name.trim()) {
        setError(`Window #${i + 1} requires a name.`);
        return;
      }
      if (w.capacity <= 0 || isNaN(w.capacity)) {
        setError(`Window "${w.name}" capacity must be greater than 0.`);
        return;
      }
      if (w.cadence === 'custom' && (!w.customIntervalHours || w.customIntervalHours <= 0)) {
        setError(`Window "${w.name}" custom cadence interval hours must be greater than 0.`);
        return;
      }
    }

    onSave({
      accountId,
      name: trimmedName,
      notes: notes.trim() || undefined,
      archived,
      windows: service ? undefined : windows,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-[#0C0A09]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1917] border border-[rgba(255,255,255,0.12)] rounded-[24px] p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] text-[#E7E5E4]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 mb-6 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[#D4F268]">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 id="service-modal-title" className="font-serif font-light text-2xl text-[#E7E5E4] tracking-tight">
                {service ? 'Edit Service' : 'Add Service & Limit Windows'}
              </h2>
              <p className="text-xs text-[#A8A29E] font-sans mt-0.5">
                {service ? 'Update service metadata & tracking preferences' : 'Select a preset or configure custom tracking windows'}
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

          {/* Account Selection */}
          <div>
            <label htmlFor="svc-account" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Associated Account <span className="text-[#D4F268]">*</span>
            </label>
            <select
              id="svc-account"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
              value={accountId}
              disabled={!!service}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              {accounts.length === 0 ? (
                <option value="">No accounts available</option>
              ) : (
                accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {acc.email ? `(${acc.email})` : ''} {acc.archived ? '[Archived]' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Presets Row (Only in Creation Mode) */}
          {!service && (
            <div>
              <label className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#D4F268]" />
                <span>Quick-Fill Service Preset</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {SERVICE_PRESETS.map((preset) => {
                  const isSelected = selectedPresetName.toLowerCase() === preset.name.toLowerCase();
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset.name, defaultTimeZone)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-mono text-center border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#141210] border-[#D4F268] text-[#E7E5E4] shadow-[0_0_12px_rgba(212,242,104,0.18)]'
                          : 'bg-[#141210]/60 border-[rgba(255,255,255,0.08)] text-[#A8A29E] hover:text-[#E7E5E4] hover:bg-[#141210] hover:border-[rgba(255,255,255,0.16)]'
                      }`}
                    >
                      <div className="font-semibold truncate">{preset.name}</div>
                      <div className="text-[10px] text-[#78716C] mt-1 truncate">
                        {preset.suggestedWindows.map((w) => w.cadence).join(' + ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Service Name */}
          <div>
            <label htmlFor="svc-name" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Service Name <span className="text-[#D4F268]">*</span>
            </label>
            <input
              id="svc-name"
              type="text"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
              placeholder="e.g., Antigravity, Google AI Studio, Gemini, Vertex AI"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="svc-notes" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Notes (Optional)
            </label>
            <input
              id="svc-notes"
              type="text"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
              placeholder="e.g., Tier limits, shared project token, daily quotas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {service && (
            <div className="p-3 bg-[#141210] rounded-xl border border-[rgba(255,255,255,0.08)]">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-mono text-[#E7E5E4]">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#0C0A09] border border-[rgba(255,255,255,0.2)] text-[#D4F268] accent-[#D4F268] focus:ring-0 cursor-pointer"
                />
                <span>Archive this service (hides associated windows)</span>
              </label>
            </div>
          )}

          {/* Initial Limit Windows Configurator (Creation Mode) */}
          {!service && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#E7E5E4] font-mono">
                    Limit Windows ({windows.length})
                  </h4>
                  <p className="text-[11px] text-[#A8A29E] font-sans">
                    Multiple windows (e.g. hourly burst + weekly allotment) can coexist and reset independently.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomWindow}
                  className="btn-dark-solid bg-[#292524] text-[#E7E5E4] px-3.5 py-1.5 rounded-full text-xs border border-[rgba(255,255,255,0.1)] hover:bg-[#383431] transition-all font-sans cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[#D4F268]" />
                  <span>Add Window</span>
                </button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {windows.map((win, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-[#141210] border border-[rgba(255,255,255,0.08)] rounded-2xl text-xs space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-2">
                      <span className="font-mono text-xs text-[#D4F268] font-semibold">
                        Window #{idx + 1}
                      </span>
                      {windows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWindow(idx)}
                          className="p-1 rounded text-[#f87171] hover:bg-[rgba(248,113,113,0.15)] transition-all bg-transparent border-0 cursor-pointer"
                          title="Remove window"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1">
                          Window Name
                        </label>
                        <input
                          type="text"
                          className="w-full bg-[#0C0A09] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                          value={win.name}
                          onChange={(e) => handleWindowChange(idx, { name: e.target.value })}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1">
                            Capacity
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            className="w-full bg-[#0C0A09] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                            value={win.capacity}
                            onChange={(e) =>
                              handleWindowChange(idx, { capacity: parseFloat(e.target.value) || 0 })
                            }
                            required
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1">
                            Unit
                          </label>
                          <select
                            className="w-full bg-[#0C0A09] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
                            value={win.unit}
                            onChange={(e) =>
                              handleWindowChange(idx, { unit: e.target.value as UnitType })
                            }
                          >
                            <option value="requests">requests</option>
                            <option value="credits">credits</option>
                            <option value="percent">percent</option>
                            <option value="custom">custom</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {win.unit === 'custom' && (
                      <div>
                        <label className="text-[11px] font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1">
                          Custom Unit Name
                        </label>
                        <input
                          type="text"
                          className="w-full bg-[#0C0A09] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                          placeholder="e.g., tokens, calls, megabytes"
                          value={win.customUnitName || ''}
                          onChange={(e) => handleWindowChange(idx, { customUnitName: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1">
                          Cadence
                        </label>
                        <select
                          className="w-full bg-[#0C0A09] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
                          value={win.cadence}
                          onChange={(e) =>
                            handleWindowChange(idx, { cadence: e.target.value as CadenceType })
                          }
                        >
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="custom">Custom Hours</option>
                        </select>
                      </div>

                      {win.cadence === 'custom' ? (
                        <div>
                          <label className="text-[11px] font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1">
                            Interval (Hours)
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="w-full bg-[#0C0A09] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                            value={win.customIntervalHours || 12}
                            onChange={(e) =>
                              handleWindowChange(idx, {
                                customIntervalHours: parseInt(e.target.value, 10) || 1,
                              })
                            }
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-[11px] font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1">
                            Reset Anchor
                          </label>
                          <input
                            type="datetime-local"
                            className="w-full bg-[#0C0A09] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                            value={toLocalDatetimeInputValue(new Date(win.resetAnchor))}
                            onChange={(e) => {
                              const dt = new Date(e.target.value);
                              if (!isNaN(dt.getTime())) {
                                handleWindowChange(idx, { resetAnchor: dt.toISOString() });
                              }
                            }}
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[11px] font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1">
                          Time Zone
                        </label>
                        <select
                          className="w-full bg-[#0C0A09] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all cursor-pointer"
                          value={win.timeZone}
                          onChange={(e) => handleWindowChange(idx, { timeZone: e.target.value })}
                        >
                          {COMMON_TIMEZONES.includes(win.timeZone) ? null : (
                            <option value={win.timeZone}>{win.timeZone}</option>
                          )}
                          {COMMON_TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
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
            >
              {service ? 'Save Service' : 'Create Service & Windows'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
