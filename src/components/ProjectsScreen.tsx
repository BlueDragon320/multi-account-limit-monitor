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
  X,
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
  const [filterWindowId, setFilterWindowId] = useState<string>('all');
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

  // Distinct account options for filter dropdown including deleted accounts with records
  const accountFilterOptions = useMemo(() => {
    const existingAccountIds = new Set(accounts.map((a) => a.id));
    const list: Array<{ id: string; name: string }> = accounts.map((a) => ({
      id: a.id,
      name: a.name,
    }));

    // Find any deleted accounts referenced in usageEvents
    const deletedAccountsMap = new Map<string, string>();
    usageEvents.forEach((evt) => {
      if (evt.accountId && !existingAccountIds.has(evt.accountId) && !deletedAccountsMap.has(evt.accountId)) {
        deletedAccountsMap.set(evt.accountId, evt.accountName || 'Deleted Account');
      }
    });

    deletedAccountsMap.forEach((name, id) => {
      list.push({
        id,
        name: `${name} (Deleted)`,
      });
    });

    return list;
  }, [accounts, usageEvents]);

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
        if (filterWindowId !== 'all' && !evt.effects.some((eff) => eff.windowId === filterWindowId)) {
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
          const endMs = new Date(endDate).getTime() + 86400000;
          if (new Date(evt.timestamp).getTime() >= endMs) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [
    usageEvents,
    selectedProjectId,
    filterWindowId,
    filterAccountId,
    filterServiceId,
    filterType,
    startDate,
    endDate,
  ]);

  const hasActiveFilters =
    selectedProjectId !== 'all' ||
    filterWindowId !== 'all' ||
    filterAccountId !== 'all' ||
    filterServiceId !== 'all' ||
    filterType !== 'all' ||
    Boolean(startDate) ||
    Boolean(endDate);

  const resetAllFilters = () => {
    setSelectedProjectId('all');
    setFilterWindowId('all');
    setFilterAccountId('all');
    setFilterServiceId('all');
    setFilterType('all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.1)] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1C1917] border border-[rgba(255,255,255,0.1)] text-[11px] font-mono text-[#A8A29E] mb-2">
            <span className="w-2 h-2 rounded-full bg-[#D4F268] shadow-[0_0_8px_#D4F268]" />
            <span className="tech-tag text-[#E7E5E4]">Fig. 03 • Attribution & Ledger</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-[#E7E5E4]">
            Projects & <em>Usage History</em>
          </h1>
          <p className="text-sm text-[#A8A29E] font-sans mt-1 max-w-xl">
            Audit trail of quota consumption and balance calibrations with strict unit segregation.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-sans text-[#A8A29E] hover:text-[#E7E5E4] select-none">
            <input
              type="checkbox"
              checked={showArchivedProjects}
              onChange={(e) => setShowArchivedProjects(e.target.checked)}
              className="rounded bg-[#0C0A09] border-[rgba(255,255,255,0.15)] text-[#D4F268] focus:ring-0 cursor-pointer"
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
      <section aria-label="Projects Management" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-[#A8A29E] font-mono font-medium flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-[#D4F268]" />
            <span>Project Allocations ({visibleProjects.length})</span>
          </div>
          {selectedProjectId !== 'all' && (
            <button
              onClick={() => setSelectedProjectId('all')}
              className="text-[11px] text-[#D4F268] hover:underline bg-transparent border-0 cursor-pointer font-mono"
            >
              &larr; View Aggregated Totals
            </button>
          )}
        </div>

        {visibleProjects.length === 0 ? (
          <div className="card-panel-deep p-8 text-center border border-[rgba(255,255,255,0.1)] rounded-[24px] space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#1C1917] border border-[rgba(255,255,255,0.1)] text-[#D4F268] mx-auto flex items-center justify-center">
              <Folder className="w-5 h-5" />
            </div>
            <p className="text-xs text-[#A8A29E]">No projects created yet.</p>
            <button
              onClick={onOpenAddProject}
              className="btn-primary-cream text-xs h-8 px-4 rounded-full"
            >
              <Plus className="w-3 h-3" />
              <span>Create First Project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {/* All Projects Overview Card */}
            <div
              onClick={() => setSelectedProjectId('all')}
              className={`p-4 rounded-[20px] border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                selectedProjectId === 'all'
                  ? 'bg-[#1C1917] border-[#D4F268] shadow-[0_0_12px_rgba(212,242,104,0.18)]'
                  : 'bg-[#141210] border-[rgba(255,255,255,0.08)] hover:bg-[#1C1917] hover:border-[rgba(255,255,255,0.15)]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-xs sm:text-sm text-[#E7E5E4] font-mono">
                    All Projects
                  </span>
                  <span className="tech-tag text-[10px] text-[#D4F268]">
                    {usageEvents.filter((e) => e.type === 'usage').length} logs
                  </span>
                </div>
                <div className="text-[11px] text-[#A8A29E] font-sans">
                  Aggregated multi-unit portfolio view
                </div>
              </div>
              <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] text-[10px] text-[#78716C] font-mono flex items-center justify-between">
                <span>Scope: Global</span>
                <span className="text-[#D4F268] font-medium">Select &rarr;</span>
              </div>
            </div>

            {/* Individual Project Cards */}
            {visibleProjects.map((project) => {
              const isSelected = selectedProjectId === project.id;
              const projectEvts = usageEvents.filter((e) => e.projectId === project.id);

              return (
                <div
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`p-4 rounded-[20px] border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#1C1917] border-[#D4F268] shadow-[0_0_12px_rgba(212,242,104,0.18)]'
                      : 'bg-[#141210] border-[rgba(255,255,255,0.08)] hover:bg-[#1C1917] hover:border-[rgba(255,255,255,0.15)]'
                  } ${project.archived ? 'opacity-65' : ''}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="font-semibold text-xs sm:text-sm text-[#E7E5E4] font-mono truncate max-w-[160px]"
                        title={project.name}
                      >
                        {project.name}
                      </span>
                      {project.archived && (
                        <span className="badge badge-muted text-[8px]">Archived</span>
                      )}
                    </div>
                    {project.notes ? (
                      <p className="text-[11px] text-[#A8A29E] font-sans line-clamp-2 mb-2 leading-relaxed">
                        {project.notes}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#78716C] italic font-mono mb-2">
                        No description
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-[rgba(255,255,255,0.06)] text-[11px] text-[#A8A29E] font-mono">
                    <span>{projectEvts.length} events</span>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onOpenEditProject(project)}
                        className="w-6 h-6 rounded-full bg-[#1C1917] hover:bg-[#292524] text-[#A8A29E] hover:text-[#E7E5E4] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                        title="Edit project"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={() => onArchiveProject(project.id, !project.archived)}
                        className="w-6 h-6 rounded-full bg-[#1C1917] hover:bg-[rgba(248,113,113,0.15)] text-[#A8A29E] hover:text-[#f87171] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                        title={project.archived ? 'Restore project' : 'Archive project'}
                      >
                        {project.archived ? (
                          <ArchiveRestore className="w-2.5 h-2.5" />
                        ) : (
                          <Archive className="w-2.5 h-2.5" />
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
      <section aria-label="Segregated Project Totals" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#E7E5E4] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#D4F268]" />
              <span>
                {selectedProjectId === 'all'
                  ? 'All Projects — Segregated Totals Breakdown'
                  : `Project Totals: ${projectMap.get(selectedProjectId)?.name || 'Selected Project'} — Segregated Totals Breakdown`}
              </span>
            </h2>
            <p className="text-xs text-[#A8A29E] mt-0.5">
              Strictly keeps units and capacities isolated into discrete dimensional buckets to eliminate misleading arithmetic sums.
            </p>
          </div>
        </div>

        {/* Dimensional Integrity Notice Banner */}
        <div className="p-4 bg-[#141210] border border-[rgba(255,255,255,0.1)] rounded-[20px] text-xs text-[#A8A29E] flex items-start gap-3">
          <Info className="w-4 h-4 text-[#D4F268] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-[#E7E5E4] font-medium font-sans">Dimensional Integrity Notice:</strong>{' '}
            Requests, credits, tokens, and percentages cannot be summed together. Furthermore, percentages across differing capacities represent entirely different quantities (e.g. 50% of 100 &ne; 50% of 1,000). Quota Ember preserves each window bucket independently.
          </div>
        </div>

        {/* Breakdown Buckets Display */}
        {selectedProjectId === 'all' ? (
          /* Multi-project breakdown view */
          <div className="space-y-4">
            {allProjectReports.length === 0 ? (
              <div className="card-panel-deep p-8 text-center text-xs text-[#A8A29E] rounded-[24px]">
                No project usage has been logged yet.
              </div>
            ) : (
              allProjectReports.map((report) => {
                const proj = projectMap.get(report.projectId);
                return (
                  <div
                    key={report.projectId}
                    className="card-panel p-5 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3">
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-[#D4F268]" />
                        <span className="font-semibold text-sm text-[#E7E5E4] font-mono">
                          {proj ? proj.name : 'Unknown Project'}
                        </span>
                      </div>
                      <span className="tech-tag text-[10px] text-[#A8A29E]">
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
                            className="p-4 bg-[#141210] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)] rounded-[16px] text-xs font-mono space-y-2 transition-colors"
                          >
                            <div className="text-[11px] text-[#A8A29E] truncate font-medium">
                              {bucket.windowName}
                            </div>
                            <div className="text-xl font-light text-[#D4F268] tracking-tight">
                              {formatNumber(bucket.totalAmount)}{' '}
                              <span className="text-xs font-normal text-[#E7E5E4]">{unitName}</span>
                            </div>
                            {/* Capacity mini progress */}
                            <div className="progress-track h-1.5 bg-[#0C0A09] rounded-full overflow-hidden border border-[rgba(255,255,255,0.06)]">
                              <div
                                className="h-full bg-[#D4F268] rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, pctOfCap))}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-[#78716C] flex items-center justify-between">
                              <span>
                                {Math.round(pctOfCap)}% of {formatNumber(bucket.capacity)} capacity
                              </span>
                              <span>{bucket.eventCount} event(s)</span>
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
          <div className="card-panel p-6 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] space-y-4">
            {selectedProjectReport && selectedProjectReport.segregatedTotals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {selectedProjectReport.segregatedTotals.map((bucket) => {
                  const unitName =
                    bucket.unit === 'custom' ? bucket.customUnitName || 'custom' : bucket.unit;
                  const pctOfCap =
                    bucket.capacity > 0 ? (bucket.totalAmount / bucket.capacity) * 100 : 0;

                  return (
                    <div
                      key={bucket.bucketKey}
                      className="p-4 bg-[#141210] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)] rounded-[16px] text-xs font-mono space-y-2 transition-colors"
                    >
                      <div className="text-[11px] text-[#A8A29E] truncate font-medium">
                        {bucket.windowName}
                      </div>
                      <div className="text-2xl font-light text-[#D4F268] tracking-tight">
                        {formatNumber(bucket.totalAmount)}{' '}
                        <span className="text-sm font-normal text-[#E7E5E4]">{unitName}</span>
                      </div>
                      {/* Capacity mini progress */}
                      <div className="progress-track h-1.5 bg-[#0C0A09] rounded-full overflow-hidden border border-[rgba(255,255,255,0.06)]">
                        <div
                          className="h-full bg-[#D4F268] rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, pctOfCap))}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-[#78716C] flex items-center justify-between">
                        <span>
                          {Math.round(pctOfCap)}% of {formatNumber(bucket.capacity)} capacity
                        </span>
                        <span>{bucket.eventCount} event(s)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs text-[#A8A29E] py-8 font-mono">
                No recorded usage for this project yet.
              </div>
            )}
          </div>
        )}
      </section>

      {/* USAGE HISTORY & AUDIT TRAIL */}
      <section aria-label="Usage History Table" className="space-y-4">
        {/* Filter Toolbar with Dark Styled Select Dropdowns */}
        <div className="card-panel p-5 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wider text-[#A8A29E] font-mono font-medium flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-[#D4F268]" />
              <span>Audit Trail Filters ({filteredHistory.length} events)</span>
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs text-[#D4F268] hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer self-start sm:self-auto font-mono"
              >
                <X className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Dark Styled Dropdowns Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Filter by Project */}
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-[#D4F268] cursor-pointer"
              aria-label="Filter by project"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  Project: {p.name}
                </option>
              ))}
            </select>

            {/* Filter by Limit Window */}
            <select
              value={filterWindowId}
              onChange={(e) => setFilterWindowId(e.target.value)}
              className="bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-[#D4F268] cursor-pointer"
              aria-label="Filter by limit window"
            >
              <option value="all">All Limit Windows</option>
              {limitWindows.map((w) => (
                <option key={w.id} value={w.id}>
                  Window: {w.name} ({w.cadence})
                </option>
              ))}
            </select>

            {/* Filter by Event Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-[#D4F268] cursor-pointer"
              aria-label="Filter by event type"
            >
              <option value="all">All Event Types</option>
              <option value="usage">Usage Events Only</option>
              <option value="correction">Manual Corrections Only</option>
            </select>

            {/* Filter by Account */}
            <select
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-[#D4F268] cursor-pointer"
              aria-label="Filter by account"
            >
              <option value="all">All Accounts</option>
              {accountFilterOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {`Account: ${a.name}`}
                </option>
              ))}
            </select>

            {/* Date Pickers */}
            <div className="flex items-center gap-1.5 text-xs text-[#A8A29E]">
              <span className="text-[11px] font-mono">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-full px-3 py-1 text-xs focus:outline-none focus:border-[#D4F268]"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-[#A8A29E]">
              <span className="text-[11px] font-mono">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-full px-3 py-1 text-xs focus:outline-none focus:border-[#D4F268]"
              />
            </div>
          </div>
        </div>

        {/* Sleek Dark Event Table */}
        {filteredHistory.length === 0 ? (
          <div className="card-panel-deep p-12 text-center border border-[rgba(255,255,255,0.1)] rounded-[24px] text-xs text-[#A8A29E] font-mono">
            No usage or correction records found matching the active filter criteria.
          </div>
        ) : (
          <div className="card-panel p-0 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] rounded-[24px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#141210] text-[#A8A29E] border-b border-[rgba(255,255,255,0.1)] text-[11px] font-mono uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-medium">Type</th>
                    <th className="py-3 px-4 font-medium">Timestamp</th>
                    <th className="py-3 px-4 font-medium">Project / Identity</th>
                    <th className="py-3 px-4 font-medium">Window & Allocation Effects</th>
                    <th className="py-3 px-4 font-medium">Notes / Reason</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.06)] font-sans">
                  {filteredHistory.map((evt) => {
                    const isCorrection = evt.type === 'correction';
                    const proj = evt.projectId ? projectMap.get(evt.projectId) : null;
                    const acc = accountMap.get(evt.accountId);
                    const svc = serviceMap.get(evt.serviceId);

                    return (
                      <tr
                        key={evt.id}
                        className="hover:bg-[#141210] transition-colors"
                      >
                        {/* Event Type Badge: Distinct USAGE vs MANUAL CORRECTION styling */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          {isCorrection ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider bg-[rgba(251,191,36,0.15)] text-[#fbbf24] border border-[rgba(251,191,36,0.3)]">
                              <RotateCcw className="w-3 h-3 text-[#fbbf24]" />
                              <span>Manual Correction</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider bg-[rgba(212,242,104,0.15)] text-[#D4F268] border border-[rgba(212,242,104,0.3)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D4F268]" />
                              <span>Usage</span>
                            </span>
                          )}
                        </td>

                        {/* Monospace Timestamp */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap font-mono text-[#E7E5E4]">
                          <div className="text-xs">
                            {new Date(evt.timestamp).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-[#78716C] mt-0.5">
                            {formatRelativeTime(evt.timestamp)}
                          </div>
                        </td>

                        {/* Project / Identity */}
                        <td className="py-3.5 px-4 align-top">
                          {isCorrection ? (
                            <span className="text-xs text-[#A8A29E] italic font-mono">
                              Console Calibration
                            </span>
                          ) : (
                            <span className="font-semibold text-xs text-[#E7E5E4] font-mono">
                              {proj ? proj.name : 'Unknown Project'}
                            </span>
                          )}
                          <div className="text-[10px] text-[#78716C] font-mono mt-0.5">
                            {acc ? acc.name : (evt.accountName || 'Deleted Account')} {svc ? `> ${svc.name}` : evt.serviceName ? `> ${evt.serviceName}` : ''}
                          </div>
                        </td>

                        {/* Window & Allocation Effects (Monospace numbers) */}
                        <td className="py-3.5 px-4 align-top font-mono">
                          <div className="space-y-1.5">
                            {evt.effects.map((eff, i) => {
                              const win = windowMap.get(eff.windowId);
                              const unitName = win
                                ? win.unit === 'custom'
                                  ? win.customUnitName || 'custom'
                                  : win.unit
                                : '';
                              return (
                                <div key={i} className="text-xs leading-snug">
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
                                  <span className="text-[10px] text-[#78716C]">
                                    ({formatNumber(eff.previousUsed)} &rarr; {formatNumber(eff.newUsed)})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* Notes / Reason */}
                        <td className="py-3.5 px-4 align-top max-w-xs">
                          {evt.note ? (
                            <span className="text-[#E7E5E4] text-xs break-words font-mono">
                              {evt.note}
                            </span>
                          ) : (
                            <span className="text-[#78716C] italic font-mono">—</span>
                          )}
                        </td>

                        {/* Actions with Clean Icon Button Styling */}
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onOpenEditHistory(evt)}
                              className="w-7 h-7 rounded-full bg-[#141210] hover:bg-[#292524] text-[#A8A29E] hover:text-[#E7E5E4] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                              title="Edit note or timestamp"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => onOpenDeleteHistory(evt)}
                              className="w-7 h-7 rounded-full bg-[#141210] hover:bg-[rgba(248,113,113,0.15)] text-[#A8A29E] hover:text-[#f87171] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete history record"
                            >
                              <Trash2 className="w-3 h-3" />
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
