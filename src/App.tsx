import React, { useState } from 'react';
import { useAppState } from './domain/useAppState';
import { Account, Service, LimitWindow, Project, UsageEvent } from './domain/types';
import { ValidationResult, ImportDiff } from './storage/exportImport';
import {
  Navbar,
  NavTab,
  OverviewScreen,
  AccountsScreen,
  ProjectsScreen,
  SettingsScreen,
  ConfirmDialog,
  AccountModal,
  ServiceModal,
  LimitWindowModal,
  ProjectModal,
  LogUsageModal,
  CorrectBalanceModal,
  ImportPreviewModal,
  EditHistoryModal,
  PasswordGate,
} from './components';

export const App: React.FC = () => {
  const {
    state,
    addAccount,
    updateAccount,
    archiveAccount,
    deleteAccount,
    addService,
    updateService,
    archiveService,
    addLimitWindow,
    updateLimitWindow,
    archiveLimitWindow,
    addProject,
    updateProject,
    archiveProject,
    recordUsage,
    recordBalanceCorrection,
    updateUsageEvent,
    deleteUsageEvent,
    updateSettings,
    replaceAllState,
    resetAllData,
  } = useAppState();

  // Environment password protection (supports Docker runtime window.__ENV__, Vite env, or default fallback)
  const configuredPassword = (
    (typeof window !== 'undefined' && window.__ENV__?.VITE_APP_PASSWORD) ||
    import.meta.env.VITE_APP_PASSWORD ||
    'password123'
  ).trim();
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (!configuredPassword) return true;
    return (
      sessionStorage.getItem('quota_ember_unlocked') === 'true' ||
      localStorage.getItem('quota_ember_unlocked') === 'true'
    );
  });

  const handleLock = () => {
    sessionStorage.removeItem('quota_ember_unlocked');
    localStorage.removeItem('quota_ember_unlocked');
    setIsUnlocked(false);
  };

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

  // Modal visibility states
  const [logUsageOpen, setLogUsageOpen] = useState(false);
  const [logUsagePreselectedWinId, setLogUsagePreselectedWinId] = useState<string | undefined>();

  const [correctBalanceOpen, setCorrectBalanceOpen] = useState(false);
  const [correctBalancePreselectedWinId, setCorrectBalancePreselectedWinId] = useState<string | undefined>();

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceModalAccountId, setServiceModalAccountId] = useState<string>('');
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [windowModalOpen, setWindowModalOpen] = useState(false);
  const [windowModalServiceId, setWindowModalServiceId] = useState<string>('');
  const [windowModalAccountId, setWindowModalAccountId] = useState<string>('');
  const [windowModalServiceName, setWindowModalServiceName] = useState<string>('');
  const [editingWindow, setEditingWindow] = useState<LimitWindow | null>(null);

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [editHistoryOpen, setEditHistoryOpen] = useState(false);
  const [editingHistoryEvent, setEditingHistoryEvent] = useState<UsageEvent | null>(null);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Import preview modal state
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importDiff, setImportDiff] = useState<ImportDiff | null>(null);

  // Helper for opening confirm dialog
  const openConfirm = (config: {
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmConfig(config);
    setConfirmOpen(true);
  };

  // Log usage triggers
  const handleOpenLogUsage = (preselectedWindowId?: string) => {
    setLogUsagePreselectedWinId(preselectedWindowId);
    setLogUsageOpen(true);
  };

  // Correct balance trigger
  const handleOpenCorrectBalance = (windowId: string) => {
    setCorrectBalancePreselectedWinId(windowId);
    setCorrectBalanceOpen(true);
  };

  // Account actions
  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    setAccountModalOpen(true);
  };

  const handleOpenEditAccount = (account: Account) => {
    setEditingAccount(account);
    setAccountModalOpen(true);
  };

  const handleSaveAccount = (data: { name: string; email?: string; notes?: string; archived?: boolean }) => {
    if (editingAccount) {
      updateAccount(editingAccount.id, data);
    } else {
      addAccount({
        name: data.name,
        email: data.email,
        notes: data.notes,
        archived: false,
      });
    }
  };

  const handleArchiveAccount = (accountId: string, archive: boolean) => {
    if (archive) {
      const acc = state.accounts.find((a) => a.id === accountId);
      openConfirm({
        title: 'Archive Account?',
        message: `Are you sure you want to archive account "${acc?.name || 'Account'}"? Its services and windows will be hidden from the active overview.`,
        confirmLabel: 'Archive Account',
        isDestructive: false,
        onConfirm: () => {
          archiveAccount(accountId, true);
          setConfirmOpen(false);
        },
      });
    } else {
      archiveAccount(accountId, false);
    }
  };

  const handleDeleteAccount = (accountId: string) => {
    const acc = state.accounts.find((a) => a.id === accountId);
    const accName = acc?.name || 'Account';
    openConfirm({
      title: `Delete Account "${accName}"`,
      message: `Deleting this account will permanently remove it along with its active services and limit windows from your dashboard. All historical usage and calibration records will be safely preserved in your Project History under '${accName}'.`,
      confirmLabel: 'Delete Account',
      isDestructive: true,
      onConfirm: () => {
        deleteAccount(accountId);
        setConfirmOpen(false);
      },
    });
  };

  // Service actions
  const handleOpenAddService = (accountId: string) => {
    setEditingService(null);
    setServiceModalAccountId(accountId);
    setServiceModalOpen(true);
  };

  const handleOpenEditService = (service: Service) => {
    setEditingService(service);
    setServiceModalAccountId(service.accountId);
    setServiceModalOpen(true);
  };

  const handleSaveService = (data: {
    accountId: string;
    name: string;
    notes?: string;
    archived?: boolean;
    windows?: any[];
  }) => {
    if (editingService) {
      updateService(editingService.id, {
        name: data.name,
        notes: data.notes,
        archived: data.archived,
      });
    } else {
      addService(
        {
          accountId: data.accountId,
          name: data.name,
          notes: data.notes,
          archived: false,
        },
        data.windows
      );
    }
  };

  const handleArchiveService = (serviceId: string, archive: boolean) => {
    if (archive) {
      const svc = state.services.find((s) => s.id === serviceId);
      openConfirm({
        title: 'Archive Service?',
        message: `Are you sure you want to archive service "${svc?.name || 'Service'}"? Its limit windows will be hidden from the active overview.`,
        confirmLabel: 'Archive Service',
        isDestructive: false,
        onConfirm: () => {
          archiveService(serviceId, true);
          setConfirmOpen(false);
        },
      });
    } else {
      archiveService(serviceId, false);
    }
  };

  // Window actions
  const handleOpenAddWindow = (serviceId: string, accountId: string, serviceName: string) => {
    setEditingWindow(null);
    setWindowModalServiceId(serviceId);
    setWindowModalAccountId(accountId);
    setWindowModalServiceName(serviceName);
    setWindowModalOpen(true);
  };

  const handleOpenEditWindow = (window: LimitWindow, serviceName: string) => {
    setEditingWindow(window);
    setWindowModalServiceId(window.serviceId);
    setWindowModalAccountId(window.accountId);
    setWindowModalServiceName(serviceName);
    setWindowModalOpen(true);
  };

  const handleSaveWindow = (data: any) => {
    if (editingWindow) {
      updateLimitWindow(editingWindow.id, data);
    } else {
      addLimitWindow(data);
    }
  };

  const handleArchiveWindow = (windowId: string, archive: boolean) => {
    if (archive) {
      const win = state.limitWindows.find((w) => w.id === windowId);
      openConfirm({
        title: 'Archive Limit Window?',
        message: `Are you sure you want to archive window "${win?.name || 'Window'}"? It will no longer appear on the Overview dashboard.`,
        confirmLabel: 'Archive Window',
        isDestructive: false,
        onConfirm: () => {
          archiveLimitWindow(windowId, true);
          setConfirmOpen(false);
        },
      });
    } else {
      archiveLimitWindow(windowId, false);
    }
  };

  // Project actions
  const handleOpenAddProject = () => {
    setEditingProject(null);
    setProjectModalOpen(true);
  };

  const handleOpenEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  const handleSaveProject = (data: { name: string; notes?: string; archived?: boolean }) => {
    if (editingProject) {
      updateProject(editingProject.id, data);
    } else {
      addProject({
        name: data.name,
        notes: data.notes,
        archived: false,
      });
    }
  };

  const handleArchiveProject = (projectId: string, archive: boolean) => {
    if (archive) {
      const proj = state.projects.find((p) => p.id === projectId);
      openConfirm({
        title: 'Archive Project?',
        message: `Are you sure you want to archive project "${proj?.name || 'Project'}"?`,
        confirmLabel: 'Archive Project',
        isDestructive: false,
        onConfirm: () => {
          archiveProject(projectId, true);
          setConfirmOpen(false);
        },
      });
    } else {
      archiveProject(projectId, false);
    }
  };

  // History entry actions
  const handleOpenEditHistory = (event: UsageEvent) => {
    setEditingHistoryEvent(event);
    setEditHistoryOpen(true);
  };

  const handleSaveHistoryEdit = (eventId: string, updates: { timestamp?: string; note?: string }) => {
    updateUsageEvent(eventId, updates);
  };

  const handleOpenDeleteHistory = (event: UsageEvent) => {
    openConfirm({
      title: 'Delete History Entry?',
      message: `Are you sure you want to permanently delete this ${
        event.type === 'correction' ? 'manual correction' : 'usage event'
      }? Note that deleting a historical record will not automatically rewrite past window reset cycles.`,
      confirmLabel: 'Delete Entry',
      isDestructive: true,
      onConfirm: () => {
        deleteUsageEvent(event.id);
        setConfirmOpen(false);
      },
    });
  };

  // Clear all data
  const handleRequestClearAll = () => {
    openConfirm({
      title: 'Wipe All Local Data?',
      message:
        'This will erase all accounts, limit windows, projects, and usage history from this browser. This action CANNOT be undone unless you have an exported JSON backup file.',
      confirmLabel: 'Wipe All Data',
      isDestructive: true,
      onConfirm: () => {
        resetAllData();
        setConfirmOpen(false);
      },
    });
  };

  // Import preview
  const handleTriggerImportModal = (validation: ValidationResult, diff: ImportDiff) => {
    setValidationResult(validation);
    setImportDiff(diff);
    setImportPreviewOpen(true);
  };

  const handleConfirmImportReplace = (incomingState: any) => {
    replaceAllState(incomingState);
  };

  if (!isUnlocked && configuredPassword) {
    return (
      <PasswordGate
        configuredPassword={configuredPassword}
        onUnlock={() => setIsUnlocked(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0A09] text-[#E7E5E4] flex flex-col font-sans selection:bg-[#D4F268] selection:text-[#0C0A09] relative overflow-x-hidden">
      {/* 4% Fixed Noise Overlay */}
      <div className="noise-overlay" aria-hidden="true" />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenLogUsage={() => handleOpenLogUsage()}
        onLock={configuredPassword ? handleLock : undefined}
      />

      {/* Main Content Screen */}
      <div className="flex-1 w-full">
        {activeTab === 'overview' && (
          <OverviewScreen
            state={state}
            onOpenLogUsage={handleOpenLogUsage}
            onOpenCorrectBalance={handleOpenCorrectBalance}
            onNavigateToAccounts={() => setActiveTab('accounts')}
            onOpenAddAccount={handleOpenAddAccount}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsScreen
            state={state}
            onOpenAddAccount={handleOpenAddAccount}
            onOpenEditAccount={handleOpenEditAccount}
            onArchiveAccount={handleArchiveAccount}
            onDeleteAccount={handleDeleteAccount}
            onOpenAddService={handleOpenAddService}
            onOpenEditService={handleOpenEditService}
            onArchiveService={handleArchiveService}
            onOpenAddWindow={handleOpenAddWindow}
            onOpenEditWindow={handleOpenEditWindow}
            onArchiveWindow={handleArchiveWindow}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsScreen
            state={state}
            onOpenAddProject={handleOpenAddProject}
            onOpenEditProject={handleOpenEditProject}
            onArchiveProject={handleArchiveProject}
            onOpenEditHistory={handleOpenEditHistory}
            onOpenDeleteHistory={handleOpenDeleteHistory}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            state={state}
            onUpdateSettings={updateSettings}
            onTriggerImportModal={handleTriggerImportModal}
            onRequestClearAll={handleRequestClearAll}
            onLock={configuredPassword ? handleLock : undefined}
          />
        )}
      </div>

      {/* Footer with Serrated Divider */}
      <footer className="border-t border-[rgba(255,255,255,0.08)] py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-[#A8A29E] font-sans">
        <div className="max-w-[1200px] w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#D4F268] shadow-[0_0_8px_#D4F268]" />
            <span className="text-[#E7E5E4] font-medium tracking-tight">Quota Ember</span>
            <span className="text-[#78716C]">— Digital Naturalism & Brutalist Technicality</span>
          </div>
          <div className="tech-tag text-[11px] text-[#78716C]">
            Client-Side State • Fig. 00-SYS • Zero Telemetry
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Log Usage Modal */}
      <LogUsageModal
        isOpen={logUsageOpen}
        accounts={state.accounts}
        services={state.services}
        limitWindows={state.limitWindows}
        projects={state.projects}
        preselectedWindowId={logUsagePreselectedWinId}
        onSave={recordUsage}
        onQuickAddProject={(name) => addProject({ name, archived: false })}
        onClose={() => setLogUsageOpen(false)}
      />

      {/* 2. Correct Balance Modal */}
      <CorrectBalanceModal
        isOpen={correctBalanceOpen}
        limitWindows={state.limitWindows}
        accounts={state.accounts}
        services={state.services}
        preselectedWindowId={correctBalancePreselectedWinId}
        onSave={recordBalanceCorrection}
        onClose={() => setCorrectBalanceOpen(false)}
      />

      {/* 3. Account Modal */}
      <AccountModal
        isOpen={accountModalOpen}
        account={editingAccount}
        onSave={handleSaveAccount}
        onClose={() => setAccountModalOpen(false)}
      />

      {/* 4. Service Modal */}
      <ServiceModal
        isOpen={serviceModalOpen}
        accounts={state.accounts.filter((a) => !a.archived)}
        selectedAccountId={serviceModalAccountId}
        service={editingService}
        defaultTimeZone={state.settings.defaultTimeZone}
        onSave={handleSaveService}
        onClose={() => setServiceModalOpen(false)}
      />

      {/* 5. Limit Window Modal */}
      <LimitWindowModal
        isOpen={windowModalOpen}
        serviceId={windowModalServiceId}
        accountId={windowModalAccountId}
        serviceName={windowModalServiceName}
        windowItem={editingWindow}
        defaultTimeZone={state.settings.defaultTimeZone}
        onSave={handleSaveWindow}
        onClose={() => setWindowModalOpen(false)}
      />

      {/* 6. Project Modal */}
      <ProjectModal
        isOpen={projectModalOpen}
        project={editingProject}
        onSave={handleSaveProject}
        onClose={() => setProjectModalOpen(false)}
      />

      {/* 7. Edit History Modal */}
      <EditHistoryModal
        isOpen={editHistoryOpen}
        event={editingHistoryEvent}
        onSave={handleSaveHistoryEdit}
        onClose={() => setEditHistoryOpen(false)}
      />

      {/* 8. Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* 9. Import Preview Modal */}
      <ImportPreviewModal
        isOpen={importPreviewOpen}
        validationResult={validationResult}
        importDiff={importDiff}
        onConfirmReplace={handleConfirmImportReplace}
        onClose={() => setImportPreviewOpen(false)}
      />
    </div>
  );
};
export default App;
