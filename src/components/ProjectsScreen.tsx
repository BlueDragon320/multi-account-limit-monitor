import React, { useState, useMemo } from 'react';
import {
  Folder,
  Plus,
  Edit2,
  Trash2,
  Archive,
  ArchiveRestore,
  History,
  Info,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { AppState, Project, UsageEvent } from '../domain/types';
import { getProjectTotals, calculateProjectTotals } from '../domain/calculations';
import { formatNumber, formatRelativeTime } from '../utils/formatters';

interface ProjectsScreenProps {
  state: AppState;
  onOpenAddProject: () => void;
  onOpenEditProject: (project: Project) => void;
  onArchiveProject: (projectId: string, archive: boolean) => void;
  onOpenEditHistory: (event: UsageEvent) => void;
  onOpenDeleteHistory: (event: UsageEvent) => void;
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({
  state,
  onOpenAddProject,
  onOpenEditProject,
  onArchiveProject,
  onOpenEditHistory,
  onOpenDeleteHistory,
}) => {
  const { projects, usageEvents, limitWindows, accounts, services } = state;

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');
  const [filterServiceId, setFilterServiceId] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'usage' | 'correction'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);

  // Lookups
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const windowMap = useMemo(() => new Map(limitWindows.map((w) => [w.id, w])), [limitWindows]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const visibleProjects = useMemo(() => {
    return projects.filter((p) => (showArchivedProjects ? true : !p.archived));
  }, [projects, showArchivedProjects]);

  // Project Totals Reports for all projects
  const allProjectReports = useMemo(() => {
    return Object.values(calculateProjectTotals(usageEvents, limitWindows));
  }, [usageEvents, limitWindows]);

  const selectedProjectReport = useMemo(() => {
    if (selectedProjectId === 'all') return null;
    return getProjectTotals(selectedProjectId, usageEvents, limitWindows);
  }, [usageEvents, limitWindows, selectedProjectId]);

  // Filtered Usage History
  const filteredHistory = useMemo(() => {
    return [...usageEvents]
      .filter((evt) => {
        if (selectedProjectId !== 'all' && evt.projectId !== selectedProjectId) {
          return false;
        }
        if (filterAccountId !== 'all' && evt.accountId !== filterAccountId) {
          return false;
        }
        if (filterServiceId !== 'all' && evt.serviceId !== filterServiceId) {
          return false;
        }
        if (filterType !== 'all' && evt.type !== filterType) {
          return false;
        }
        if (startDate) {
          const startMs = new Date(startDate).getTime();
          if (new Date(evt.timestamp).getTime() < startMs) return false;
        }
        if (endDate) {
          // Set to end of the day
          const endMs = new Date(endDate).getTime() + 86400000;
          if (new Date(evt.timestamp).getTime() >= endMs) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [usageEvents, selectedProjectId, filterAccountId, filterServiceId, filterType, startDate, endDate]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.1)] pb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-[#E7E5E4]">
            Projects & <em>Usage History</em>
          </h1>
          <p className="text-sm text-[#A8A29E] mt-1 font-sans">
            Audit trail of quota consumption and balance calibrations with strict unit segregation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[#A8A29E] hover:text-[#E7E5E4] font-sans">
            <input
              type="checkbox"
              checked={showArchivedProjects}
              onChange={(e) => setShowArchivedProjects(e.target.checked)}
              className="rounded bg-[#0C0A09] border-[rgba(255,255,255,0.1)] text-[#D4F268]"
            />
            <span>Show Archived Projects</span>
          </label>

          <button
            onClick={onOpenAddProject}
            className="btn-primary-lime text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Project</span>
          </button>
        </div>
      </div>

      {/* Projects Grid / Selector */}
      <section aria-label="Projects Management" className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-[#A8A29E] font-semibold flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-[#D4F268]" />
            <span>Projects ({visibleProjects.length})</span>
          </span>
          {selectedProjectId !== 'all' && (
            <button
              onClick={() => setSelectedProjectId('all')}
              className="text-[11px] text-[#D4F268] hover:underline bg-transparent border-0 cursor-pointer"
            >
              Show All Projects Overview
            </button>
          )}
        </div>

        {visibleProjects.length === 0 ? (
          <div className="card-panel-deep p-8 text-center border border-[rgba(255,255,255,0.1)] rounded-xl space-y-2">
            <p className="text-xs text-[#A8A29E]">No projects created yet.</p>
            <button
              onClick={onOpenAddProject}
              className="btn-primary-cream text-xs h-7 px-3"
            >
              <Plus className="w-3 h-3" />
              <span>Create First Project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* All Projects Card */}
            <div
              onClick={() => setSelectedProjectId('all')}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedProjectId === 'all'
                  ? 'bg-[#1C1917] border-[#D4F268] shadow-[0_0_8px_rgba(212,242,104,0.2)]'
                  : 'bg-[#1c1b19] border-[rgba(255,255,255,0.1)] hover:bg-[#1C1917]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs text-[#E7E5E4]">All Projects</span>
                <span className="text-[10px] text-[#A8A29E]">
                  {usageEvents.filter((e) => e.type === 'usage').length} events
                </span>
              </div>
              <div className="text-[11px] text-[#A8A29E] truncate">
                Aggregated breakdown view
              </div>
            </div>

            {/* Individual Projects */}
            {visibleProjects.map((project) => {
              const isSelected = selectedProjectId === project.id;
              const projectEvts = usageEvents.filter((e) => e.projectId === project.id);

              return (
                <div
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#1C1917] border-[#D4F268] shadow-[0_0_8px_rgba(212,242,104,0.2)]'
                      : 'bg-[#1c1b19] border-[rgba(255,255,255,0.1)] hover:bg-[#1C1917]'
                  } ${project.archived ? 'opacity-60' : ''}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-[#E7E5E4] truncate" title={project.name}>
                        {project.name}
                      </span>
                      {project.archived && (
                        <span className="badge badge-muted text-[8px]">Archived</span>
                      )}
                    </div>
                    {project.notes && (
                      <p className="text-[10px] text-[#A8A29E] line-clamp-1 mb-2">
                        {project.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#1C1917] text-[10px] text-[#A8A29E]">
                    <span>{projectEvts.length} log event(s)</span>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onOpenEditProject(project)}
                        className="text-[#A8A29E] hover:text-[#E7E5E4] p-1 bg-transparent border-0 cursor-pointer"
                        title="Edit project"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onArchiveProject(project.id, !project.archived)}
                        className="text-[#A8A29E] hover:text-[#D4F268] p-1 bg-transparent border-0 cursor-pointer"
                        title={project.archived ? 'Restore project' : 'Archive project'}
                      >
                        {project.archived ? (
                          <ArchiveRestore className="w-3 h-3" />
                        ) : (
                          <Archive className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* STRICTLY SEGREGATED PROJECT TOTALS BREAKDOWN */}
      <section aria-label="Segregated Project Totals" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#E7E5E4] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#D4F268]" />
              <span>
                {selectedProjectId === 'all'
                  ? 'All Projects — Segregated Totals Breakdown'
                  : `Project Totals: ${projectMap.get(selectedProjectId)?.name || 'Selected Project'}`}
              </span>
            </h2>
            <p className="text-[11px] text-[#A8A29E] mt-0.5">
              Strictly keeps units and capacities isolated to avoid misleading arithmetic sums.
            </p>
          </div>
        </div>

        {/* Dimension Segregation Disclaimer Banner */}
        <div className="p-3 bg-[#141210] border border-[rgba(255,255,255,0.1)] rounded-lg text-xs text-[#A8A29E] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#D4F268] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="text-[#E7E5E4] font-medium">Dimensional Integrity Notice:</span>{' '}
            Requests, credits, tokens, and percentages cannot be summed together. Furthermore, percentages across differing capacities represent entirely different quantities (e.g. 50% of 100 &ne; 50% of 1,000). Quota Ember preserves each window bucket independently.
          </div>
        </div>

        {/* Breakdown Buckets Display */}
        {selectedProjectId === 'all' ? (
          /* Multi-project breakdown view */
          <div className="space-y-3">
            {allProjectReports.length === 0 ? (
              <div className="card-panel-deep p-6 text-center text-xs text-[#A8A29E]">
                No project usage has been logged yet.
              </div>
            ) : (
              allProjectReports.map((report) => {
                const proj = projectMap.get(report.projectId);
                return (
                  <div
                    key={report.projectId}
                    className="card-panel p-4 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-[#1C1917] pb-2">
                      <span className="font-semibold text-xs text-[#E7E5E4]">
                        {proj ? proj.name : 'Unknown Project'}
                      </span>
                      <span className="text-[11px] text-[#A8A29E]">
                        {report.segregatedTotals.length} active quota bucket(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {report.segregatedTotals.map((bucket) => {
                        const unitName =
                          bucket.unit === 'custom' ? bucket.customUnitName || 'custom' : bucket.unit;
                        const pctOfCap =
                          bucket.capacity > 0 ? (bucket.totalAmount / bucket.capacity) * 100 : 0;

                        return (
                          <div
                            key={bucket.bucketKey}
                            className="p-3 bg-[#141210] border border-[rgba(255,255,255,0.1)] rounded-lg text-xs space-y-1"
                          >
                            <div className="text-[11px] text-[#A8A29E] truncate font-medium">
                              {bucket.windowName}
                            </div>
                            <div className="text-base font-bold text-[#D4F268]">
                              {formatNumber(bucket.totalAmount)} {unitName}
                            </div>
                            <div className="text-[10px] text-[#66635f]">
                              {Math.round(pctOfCap)}% of {formatNumber(bucket.capacity)} capacity • {bucket.eventCount} event(s)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Selected single project breakdown */
          <div className="card-panel p-4 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-xl space-y-3">
            {selectedProjectReport && selectedProjectReport.segregatedTotals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {selectedProjectReport.segregatedTotals.map((bucket) => {
                  const unitName =
                    bucket.unit === 'custom' ? bucket.customUnitName || 'custom' : bucket.unit;
                  const pctOfCap =
                    bucket.capacity > 0 ? (bucket.totalAmount / bucket.capacity) * 100 : 0;

                  return (
                    <div
                      key={bucket.bucketKey}
                      className="p-3 bg-[#141210] border border-[rgba(255,255,255,0.1)] rounded-lg text-xs space-y-1"
                    >
                      <div className="text-[11px] text-[#A8A29E] truncate font-medium">
                        {bucket.windowName}
                      </div>
                      <div className="text-lg font-bold text-[#D4F268]">
                        {formatNumber(bucket.totalAmount)} {unitName}
                      </div>
                      <div className="text-[10px] text-[#66635f]">
                        {Math.round(pctOfCap)}% of {formatNumber(bucket.capacity)} capacity ({bucket.eventCount} events)
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs text-[#A8A29E] py-4">
                No recorded usage for this project yet.
              </div>
            )}
          </div>
        )}
      </section>

      {/* USAGE HISTORY TABLE / LIST */}
      <section aria-label="Usage History Table" className="space-y-4">
        {/* Filter Bar */}
        <div className="card-panel p-3 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[#A8A29E] font-semibold flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#D4F268]" />
              <span>Usage & Correction History ({filteredHistory.length})</span>
            </span>
            <div className="text-[11px] text-[#A8A29E]">
              Showing all recorded events
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
            {/* Filter Account */}
            <div>
              <label className="label-text">Account</label>
              <select
                value={filterAccountId}
                onChange={(e) => setFilterAccountId(e.target.value)}
                className="input-control text-xs py-1"
              >
                <option value="all">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Service */}
            <div>
              <label className="label-text">Service</label>
              <select
                value={filterServiceId}
                onChange={(e) => setFilterServiceId(e.target.value)}
                className="input-control text-xs py-1"
              >
                <option value="all">All Services</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Type */}
            <div>
              <label className="label-text">Entry Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="input-control text-xs py-1"
              >
                <option value="all">All Types</option>
                <option value="usage">Project Usage Only</option>
                <option value="correction">Manual Corrections Only</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="label-text">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-control text-xs py-1"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="label-text">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-control text-xs py-1"
              />
            </div>
          </div>
        </div>

        {/* History Table */}
        {filteredHistory.length === 0 ? (
          <div className="card-panel-deep p-10 text-center border border-[rgba(255,255,255,0.1)] rounded-xl text-xs text-[#A8A29E]">
            No usage or correction records found matching the active filters.
          </div>
        ) : (
          <div className="card-panel p-0 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141210] text-[#A8A29E] border-b border-[rgba(255,255,255,0.1)] text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Type</th>
                    <th className="py-2.5 px-3 font-medium">Timestamp</th>
                    <th className="py-2.5 px-3 font-medium">Project / Identity</th>
                    <th className="py-2.5 px-3 font-medium">Service & Window Effects</th>
                    <th className="py-2.5 px-3 font-medium">Notes / Reason</th>
                    <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.1)]">
                  {filteredHistory.map((evt) => {
                    const isCorrection = evt.type === 'correction';
                    const proj = evt.projectId ? projectMap.get(evt.projectId) : null;
                    const acc = accountMap.get(evt.accountId);
                    const svc = serviceMap.get(evt.serviceId);

                    return (
                      <tr key={evt.id} className="hover:bg-[#1C1917] transition-colors">
                        {/* Type Badge */}
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          {isCorrection ? (
                            <span className="badge badge-warning text-[10px] flex items-center gap-1">
                              <RotateCcw className="w-3 h-3" />
                              <span>Correction</span>
                            </span>
                          ) : (
                            <span className="badge badge-coral text-[10px]">
                              <span>Usage</span>
                            </span>
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-3 align-top whitespace-nowrap text-[#E7E5E4]">
                          <div>{new Date(evt.timestamp).toLocaleString()}</div>
                          <div className="text-[10px] text-[#66635f]">
                            {formatRelativeTime(evt.timestamp)}
                          </div>
                        </td>

                        {/* Project / Identity */}
                        <td className="py-3 px-3 align-top">
                          {isCorrection ? (
                            <span className="text-[#A8A29E] italic">
                              Console Calibration
                            </span>
                          ) : (
                            <span className="font-semibold text-[#E7E5E4]">
                              {proj ? proj.name : 'Unknown Project'}
                            </span>
                          )}
                          <div className="text-[10px] text-[#66635f]">
                            {acc ? acc.name : ''} {svc ? `> ${svc.name}` : ''}
                          </div>
                        </td>

                        {/* Window Effects */}
                        <td className="py-3 px-3 align-top">
                          <div className="space-y-1.5">
                            {evt.effects.map((eff, i) => {
                              const win = windowMap.get(eff.windowId);
                              const unitName = win
                                ? win.unit === 'custom'
                                  ? win.customUnitName || 'custom'
                                  : win.unit
                                : '';
                              return (
                                <div key={i} className="text-[11px] leading-tight">
                                  <span className="text-[#A8A29E]">
                                    {win ? win.name : 'Window'}:
                                  </span>{' '}
                                  <span
                                    className={`font-semibold ${
                                      eff.amount > 0 ? 'text-[#D4F268]' : 'text-[#10b981]'
                                    }`}
                                  >
                                    {eff.amount > 0 ? `+${formatNumber(eff.amount)}` : formatNumber(eff.amount)} {unitName}
                                  </span>{' '}
                                  <span className="text-[10px] text-[#66635f]">
                                    ({formatNumber(eff.previousUsed)} &rarr; {formatNumber(eff.newUsed)})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* Notes / Reason */}
                        <td className="py-3 px-3 align-top max-w-xs">
                          {evt.note ? (
                            <span className="text-[#E7E5E4] text-xs break-words">
                              {evt.note}
                            </span>
                          ) : (
                            <span className="text-[#66635f] italic">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onOpenEditHistory(evt)}
                              className="text-[#A8A29E] hover:text-[#E7E5E4] p-1 rounded hover:bg-[#141210] bg-transparent border-0 cursor-pointer"
                              title="Edit timestamp or note"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenDeleteHistory(evt)}
                              className="text-[#A8A29E] hover:text-[#ef4444] p-1 rounded hover:bg-[#141210] bg-transparent border-0 cursor-pointer"
                              title="Delete history record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
