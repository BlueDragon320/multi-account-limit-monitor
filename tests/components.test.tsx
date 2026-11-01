import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  Navbar,
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
} from '../src/components';
import { AppState, Account, Service, LimitWindow, Project, UsageEvent } from '../src/domain/types';

describe('React UI Components Smoke & Accessibility Tests', () => {
  const mockAccount: Account = {
    id: 'acc-1',
    name: 'Production Cloud Workspace',
    email: 'admin@prod.example.com',
    notes: 'Main deployment tier',
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockService: Service = {
    id: 'srv-1',
    accountId: 'acc-1',
    name: 'Antigravity',
    notes: 'Burst agent pipelines',
    archived: false,
    createdAt: new Date().toISOString(),
  };

  const mockWindowHourly: LimitWindow = {
    id: 'win-hourly',
    serviceId: 'srv-1',
    accountId: 'acc-1',
    name: 'Hourly Request Limit',
    capacity: 100,
    unit: 'requests',
    cadence: 'hourly',
    resetAnchor: new Date().toISOString(),
    timeZone: 'UTC',
    currentUsed: 85,
    lastUpdated: new Date().toISOString(),
    archived: false,
  };

  const mockWindowWeekly: LimitWindow = {
    id: 'win-weekly',
    serviceId: 'srv-1',
    accountId: 'acc-1',
    name: 'Weekly Quota',
    capacity: 1000,
    unit: 'requests',
    cadence: 'weekly',
    resetAnchor: new Date().toISOString(),
    timeZone: 'UTC',
    currentUsed: 200,
    lastUpdated: new Date().toISOString(),
    archived: false,
  };

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Indexing Agent Alpha',
    notes: 'Vector crawling and indexing',
    archived: false,
    createdAt: new Date().toISOString(),
  };

  const mockEvent: UsageEvent = {
    id: 'evt-1',
    timestamp: new Date().toISOString(),
    projectId: 'proj-1',
    accountId: 'acc-1',
    serviceId: 'srv-1',
    type: 'usage',
    note: 'Batch run alpha',
    effects: [
      {
        windowId: 'win-hourly',
        amount: 25,
        previousUsed: 60,
        newUsed: 85,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  const mockState: AppState = {
    version: 1,
    accounts: [mockAccount],
    services: [mockService],
    limitWindows: [mockWindowHourly, mockWindowWeekly],
    projects: [mockProject],
    usageEvents: [mockEvent],
    settings: {
      defaultTimeZone: 'UTC',
      lowCapacityThresholdPercent: 80,
      staleDataThresholdHours: 24,
    },
  };

  it('renders Navbar correctly with bounded container and active tab', () => {
    const html = renderToString(
      <Navbar
        activeTab="overview"
        onSelectTab={() => {}}
        onOpenLogUsage={() => {}}
      />
    );
    expect(html).toContain('navbar-bounded');
    expect(html).toContain('QUOTA');
    expect(html).toContain('EMBER');
    expect(html).toContain('Log Usage');
    expect(html).toContain('Overview');
    expect(html).toContain('Accounts &amp; Limits');
    expect(html).toContain('Projects &amp; History');
    expect(html).toContain('Settings &amp; Data');
  });

  it('renders OverviewScreen with metrics and limit window cards', () => {
    const html = renderToString(
      <OverviewScreen
        state={mockState}
        onOpenLogUsage={() => {}}
        onOpenCorrectBalance={() => {}}
        onNavigateToAccounts={() => {}}
        onOpenAddAccount={() => {}}
      />
    );
    expect(html).toContain('Active Accounts');
    expect(html).toContain('Active Windows');
    expect(html).toContain('Hourly Request Limit');
    expect(html).toContain('Weekly Quota');
    expect(html).toContain('founder-note-card');
    expect(html).toContain('Operational Architecture');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('Near Limit');
  });

  it('renders OverviewScreen empty state when no windows exist without sample data', () => {
    const emptyState: AppState = {
      ...mockState,
      accounts: [],
      services: [],
      limitWindows: [],
      projects: [],
      usageEvents: [],
    };
    const html = renderToString(
      <OverviewScreen
        state={emptyState}
        onOpenLogUsage={() => {}}
        onOpenCorrectBalance={() => {}}
        onNavigateToAccounts={() => {}}
        onOpenAddAccount={() => {}}
      />
    );
    expect(html).toContain('No limit windows configured yet');
    expect(html).toContain('Add First Account');
  });

  it('renders AccountsScreen with account and service presets hierarchy', () => {
    const html = renderToString(
      <AccountsScreen
        state={mockState}
        onOpenAddAccount={() => {}}
        onOpenEditAccount={() => {}}
        onArchiveAccount={() => {}}
        onOpenAddService={() => {}}
        onOpenEditService={() => {}}
        onArchiveService={() => {}}
        onOpenAddWindow={() => {}}
        onOpenEditWindow={() => {}}
        onArchiveWindow={() => {}}
      />
    );
    expect(html).toContain('Production Cloud Workspace');
    expect(html).toContain('Antigravity');
    expect(html).toContain('Hourly Request Limit');
    expect(html).toContain('Weekly Quota');
  });

  it('renders ProjectsScreen with segregated totals and history records', () => {
    const html = renderToString(
      <ProjectsScreen
        state={mockState}
        onOpenAddProject={() => {}}
        onOpenEditProject={() => {}}
        onArchiveProject={() => {}}
        onOpenEditHistory={() => {}}
        onOpenDeleteHistory={() => {}}
      />
    );
    expect(html).toContain('Indexing Agent Alpha');
    expect(html).toContain('Segregated Totals Breakdown');
    expect(html).toContain('Dimensional Integrity Notice');
    expect(html).toContain('Batch run alpha');
  });

  it('renders SettingsScreen with storage warning and backup triggers', () => {
    const html = renderToString(
      <SettingsScreen
        state={mockState}
        onUpdateSettings={() => {}}
        onTriggerImportModal={() => {}}
        onRequestClearAll={() => {}}
      />
    );
    expect(html).toContain('Default Time Zone');
    expect(html).toContain('Health &amp; Warning Thresholds');
    expect(html).toContain('Export Backup (JSON)');
    expect(html).toContain('Browser Storage &amp; Privacy Architecture');
  });

  it('renders LogUsageModal with multi-window selection and preview', () => {
    const html = renderToString(
      <LogUsageModal
        isOpen={true}
        accounts={mockState.accounts}
        services={mockState.services}
        limitWindows={mockState.limitWindows}
        projects={mockState.projects}
        preselectedWindowId="win-hourly"
        onSave={() => {}}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Log Usage Event');
    expect(html).toContain('Live Balance Preview Before Saving');
    expect(html).toContain('Hourly Request Limit');
    expect(html).toContain('Confirm &amp; Save Usage');
  });

  it('renders CorrectBalanceModal with mandatory audit trail reason input', () => {
    const html = renderToString(
      <CorrectBalanceModal
        isOpen={true}
        limitWindows={mockState.limitWindows}
        accounts={mockState.accounts}
        services={mockState.services}
        preselectedWindowId="win-hourly"
        onSave={() => {}}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Manual Balance Correction');
    expect(html).toContain('Correction Reason (Mandatory Audit Trail)');
    expect(html).toContain('Audit Trail Preview');
  });

  it('renders AccountModal in create and edit mode', () => {
    const createHtml = renderToString(
      <AccountModal
        isOpen={true}
        account={null}
        onSave={() => {}}
        onClose={() => {}}
      />
    );
    expect(createHtml).toContain('Add New Account');

    const editHtml = renderToString(
      <AccountModal
        isOpen={true}
        account={mockAccount}
        onSave={() => {}}
        onClose={() => {}}
      />
    );
    expect(editHtml).toContain('Edit Account');
    expect(editHtml).toContain('Production Cloud Workspace');
  });

  it('renders ServiceModal with preset choices', () => {
    const html = renderToString(
      <ServiceModal
        isOpen={true}
        accounts={[mockAccount]}
        defaultTimeZone="UTC"
        onSave={() => {}}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Add Service &amp; Limit Windows');
    expect(html).toContain('Quick-Fill Service Preset');
    expect(html).toContain('Antigravity');
    expect(html).toContain('Google AI Studio');
  });

  it('renders LimitWindowModal for creating and editing windows', () => {
    const html = renderToString(
      <LimitWindowModal
        isOpen={true}
        serviceId="srv-1"
        accountId="acc-1"
        serviceName="Antigravity"
        windowItem={mockWindowHourly}
        defaultTimeZone="UTC"
        onSave={() => {}}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Edit Limit Window');
    expect(html).toContain('Antigravity');
    expect(html).toContain('Hourly Request Limit');
  });

  it('renders ProjectModal for creating and editing projects', () => {
    const html = renderToString(
      <ProjectModal
        isOpen={true}
        project={mockProject}
        onSave={() => {}}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Edit Project');
    expect(html).toContain('Indexing Agent Alpha');
  });

  it('renders ImportPreviewModal with comparison diff', () => {
    const validation = {
      valid: true,
      state: mockState,
      summary: {
        accountsCount: 1,
        servicesCount: 1,
        windowsCount: 2,
        projectsCount: 1,
        eventsCount: 1,
      },
    };
    const diff = {
      accounts: { current: 1, incoming: 1, delta: 0 },
      services: { current: 1, incoming: 1, delta: 0 },
      windows: { current: 2, incoming: 2, delta: 0 },
      projects: { current: 1, incoming: 1, delta: 0 },
      events: { current: 1, incoming: 1, delta: 0 },
    };
    const html = renderToString(
      <ImportPreviewModal
        isOpen={true}
        validationResult={validation}
        importDiff={diff}
        onConfirmReplace={() => {}}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Backup Import Preview');
    expect(html).toContain('Schema Valid');
    expect(html).toContain('Replace All Data');
  });

  it('renders EditHistoryModal for modifying historical metadata', () => {
    const html = renderToString(
      <EditHistoryModal
        isOpen={true}
        event={mockEvent}
        onSave={() => {}}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Edit History Entry');
    expect(html).toContain('Batch run alpha');
  });

  it('renders ConfirmDialog with customizable title and destruction prompt', () => {
    const html = renderToString(
      <ConfirmDialog
        isOpen={true}
        title="Delete Record?"
        message="This action will permanently delete the entry."
        confirmLabel="Delete Permanently"
        isDestructive={true}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(html).toContain('Delete Record?');
    expect(html).toContain('This action will permanently delete the entry.');
    expect(html).toContain('Delete Permanently');
    expect(html).toContain('btn-danger');
  });
});
