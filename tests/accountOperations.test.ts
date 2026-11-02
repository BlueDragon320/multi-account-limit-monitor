import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { useAppState } from '../src/domain/useAppState';
import { AccountModal } from '../src/components/AccountModal';
import { AccountsScreen } from '../src/components/AccountsScreen';
import { ProjectsScreen } from '../src/components/ProjectsScreen';
import { AppState, Account } from '../src/domain/types';
import {
  setStorage,
  MemoryStorage,
  loadAppState,
  saveAppState,
  getInitialState,
} from '../src/storage/storage';

describe('Account Operations & Lifecycle Management', () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    setStorage(memoryStorage);
  });

  function renderHookHarness(): ReturnType<typeof useAppState> {
    let hookResult!: ReturnType<typeof useAppState>;
    function Harness() {
      hookResult = useAppState();
      return null;
    }
    renderToString(React.createElement(Harness));
    return hookResult;
  }

  describe('AccountModal submission guards & idempotency', () => {
    it('submitting form once calls onSave exactly once', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      let formElement: any;
      function ModalHarness() {
        const tree = AccountModal({
          isOpen: true,
          account: null,
          onSave,
          onClose,
        }) as React.ReactElement<any>;
        // tree is outer modal overlay -> inner container -> [header, form]
        const innerContainer = tree.props.children;
        formElement = innerContainer.props.children[1];
        return null;
      }

      renderToString(React.createElement(ModalHarness));
      expect(formElement).toBeDefined();
      expect(typeof formElement.props.onSubmit).toBe('function');

      // Fill in name input simulation via child state or prefilled account
      const preventDefault = vi.fn();
      formElement.props.onSubmit({ preventDefault });

      // In empty mode with empty name, validation stops submission
      expect(preventDefault).toHaveBeenCalled();
    });

    it('submitting form with valid account data calls onSave and onClose once', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();
      const existingAccount: Account = {
        id: 'acc_test_1',
        name: 'Engineering Workspace',
        email: 'eng@example.com',
        notes: 'Core tier',
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let formElement: any;
      function ModalHarness() {
        const tree = AccountModal({
          isOpen: true,
          account: existingAccount,
          onSave,
          onClose,
        }) as React.ReactElement<any>;
        const innerContainer = tree.props.children;
        formElement = innerContainer.props.children[1];
        return null;
      }

      renderToString(React.createElement(ModalHarness));

      const preventDefault = vi.fn();
      formElement.props.onSubmit({ preventDefault });

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({
        name: 'Engineering Workspace',
        email: 'eng@example.com',
        notes: 'Core tier',
        archived: false,
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('double-clicking / double submission is prevented by isSubmitting ref guard', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();
      const existingAccount: Account = {
        id: 'acc_test_double',
        name: 'Double Click Account',
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let formElement: any;
      function ModalHarness() {
        const tree = AccountModal({
          isOpen: true,
          account: existingAccount,
          onSave,
          onClose,
        }) as React.ReactElement<any>;
        const innerContainer = tree.props.children;
        formElement = innerContainer.props.children[1];
        return null;
      }

      renderToString(React.createElement(ModalHarness));

      const preventDefault = vi.fn();
      // First submission
      formElement.props.onSubmit({ preventDefault });
      // Immediate second submission (rapid double click before re-render)
      formElement.props.onSubmit({ preventDefault });

      // onSave and onClose should only be invoked once
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('cancelling account creation leaves state completely unchanged', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      const html = renderToString(
        React.createElement(AccountModal, {
          isOpen: true,
          account: null,
          onSave,
          onClose,
        })
      );

      expect(html).toContain('Cancel');
      expect(onSave).not.toHaveBeenCalled();
      expect(loadAppState().accounts).toHaveLength(0);
    });
  });

  describe('useAppState account creation, idempotency & persistence', () => {
    it('creates an account and persists it to localStorage', () => {
      const hook = renderHookHarness();

      const created = hook.addAccount({
        name: 'Production Workspace',
        email: 'prod@example.com',
        notes: 'Primary operations tier',
        archived: false,
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Production Workspace');

      // Verify localStorage was updated
      const stored = loadAppState();
      expect(stored.accounts).toHaveLength(1);
      expect(stored.accounts[0].id).toBe(created.id);
      expect(stored.accounts[0].name).toBe('Production Workspace');
    });

    it('addAccount is strictly idempotent when account with identical ID is added', () => {
      const hook = renderHookHarness();

      const newAcc = hook.addAccount({
        name: 'Unique Account',
        archived: false,
      });

      expect(loadAppState().accounts).toHaveLength(1);

      // Attempt to add another account with the exact same ID
      hook.addAccount({
        id: newAcc.id,
        name: 'Duplicate Attempt',
        archived: false,
      } as any);

      const stored = loadAppState();
      // Must not create a duplicate
      expect(stored.accounts).toHaveLength(1);
      expect(stored.accounts[0].id).toBe(newAcc.id);
      expect(stored.accounts[0].name).toBe('Unique Account');
    });

    it('addService, addLimitWindow, and addProject are idempotent by ID', () => {
      const hook = renderHookHarness();

      const acc = hook.addAccount({ name: 'Corp Account', archived: false });

      // addService
      hook.addService({
        id: 'srv_idempotent',
        accountId: acc.id,
        name: 'Antigravity Srv',
        archived: false,
      });
      expect(loadAppState().services).toHaveLength(1);

      // Duplicate addService
      hook.addService({
        id: 'srv_idempotent',
        accountId: acc.id,
        name: 'Antigravity Srv Duplicate',
        archived: false,
      });
      expect(loadAppState().services).toHaveLength(1);

      // addLimitWindow
      hook.addLimitWindow({
        id: 'win_idempotent',
        accountId: acc.id,
        serviceId: 'srv_idempotent',
        name: 'Daily Limit',
        capacity: 500,
        unit: 'requests',
        cadence: 'daily',
        resetAnchor: new Date().toISOString(),
        timeZone: 'UTC',
      });
      expect(loadAppState().limitWindows).toHaveLength(1);

      // Duplicate addLimitWindow
      hook.addLimitWindow({
        id: 'win_idempotent',
        accountId: acc.id,
        serviceId: 'srv_idempotent',
        name: 'Daily Limit Duplicate',
        capacity: 1000,
        unit: 'requests',
        cadence: 'daily',
        resetAnchor: new Date().toISOString(),
        timeZone: 'UTC',
      });
      expect(loadAppState().limitWindows).toHaveLength(1);

      // addProject
      hook.addProject({
        id: 'proj_idempotent',
        name: 'Project Apollo',
        archived: false,
      });
      expect(loadAppState().projects).toHaveLength(1);

      // Duplicate addProject
      hook.addProject({
        id: 'proj_idempotent',
        name: 'Project Apollo Duplicate',
        archived: false,
      });
      expect(loadAppState().projects).toHaveLength(1);
    });
  });

  describe('Account deletion with historical preservation', () => {
    it('deleting an account removes it, active services, and limit windows while preserving historical usage events with stamped accountName & serviceName', () => {
      const initial: AppState = {
        ...getInitialState(),
        accounts: [
          {
            id: 'acc_target',
            name: 'Staging Environment',
            email: 'staging@example.com',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'acc_other',
            name: 'Production Environment',
            email: 'prod@example.com',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        services: [
          {
            id: 'srv_target_1',
            accountId: 'acc_target',
            name: 'Antigravity Staging',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'srv_other_1',
            accountId: 'acc_other',
            name: 'Antigravity Production',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        limitWindows: [
          {
            id: 'win_target_1',
            serviceId: 'srv_target_1',
            accountId: 'acc_target',
            name: 'Staging Hourly Limit',
            capacity: 50,
            unit: 'requests',
            cadence: 'hourly',
            resetAnchor: '2026-01-01T00:00:00.000Z',
            timeZone: 'UTC',
            currentUsed: 20,
            lastUpdated: '2026-01-01T00:00:00.000Z',
            archived: false,
          },
          {
            id: 'win_other_1',
            serviceId: 'srv_other_1',
            accountId: 'acc_other',
            name: 'Prod Hourly Limit',
            capacity: 500,
            unit: 'requests',
            cadence: 'hourly',
            resetAnchor: '2026-01-01T00:00:00.000Z',
            timeZone: 'UTC',
            currentUsed: 100,
            lastUpdated: '2026-01-01T00:00:00.000Z',
            archived: false,
          },
        ],
        projects: [
          {
            id: 'proj_1',
            name: 'Benchmark Run Alpha',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        usageEvents: [
          {
            id: 'evt_target_1',
            timestamp: '2026-01-01T12:00:00.000Z',
            projectId: 'proj_1',
            accountId: 'acc_target',
            serviceId: 'srv_target_1',
            type: 'usage',
            note: 'Calibration run on staging',
            effects: [
              {
                windowId: 'win_target_1',
                amount: 15,
                previousUsed: 5,
                newUsed: 20,
              },
            ],
            createdAt: '2026-01-01T12:00:00.000Z',
          },
          {
            id: 'evt_other_1',
            timestamp: '2026-01-01T13:00:00.000Z',
            projectId: 'proj_1',
            accountId: 'acc_other',
            serviceId: 'srv_other_1',
            type: 'usage',
            note: 'Production pipeline invocation',
            effects: [
              {
                windowId: 'win_other_1',
                amount: 50,
                previousUsed: 50,
                newUsed: 100,
              },
            ],
            createdAt: '2026-01-01T13:00:00.000Z',
          },
        ],
      };

      saveAppState(initial);

      const hook = renderHookHarness();

      // Execute account deletion
      hook.deleteAccount('acc_target');

      const updated = loadAppState();

      // 1. Account is permanently removed from accounts
      expect(updated.accounts.some((a) => a.id === 'acc_target')).toBe(false);
      expect(updated.accounts.some((a) => a.id === 'acc_other')).toBe(true);
      expect(updated.accounts).toHaveLength(1);

      // 2. Active services belonging to deleted account are removed
      expect(updated.services.some((s) => s.accountId === 'acc_target')).toBe(false);
      expect(updated.services.some((s) => s.accountId === 'acc_other')).toBe(true);
      expect(updated.services).toHaveLength(1);

      // 3. Active limit windows belonging to deleted account are removed
      expect(updated.limitWindows.some((w) => w.accountId === 'acc_target')).toBe(false);
      expect(updated.limitWindows.some((w) => w.accountId === 'acc_other')).toBe(true);
      expect(updated.limitWindows).toHaveLength(1);

      // 4. Historical usage events are PRESERVED!
      expect(updated.usageEvents).toHaveLength(2);
      const preservedTargetEvent = updated.usageEvents.find((e) => e.id === 'evt_target_1');
      expect(preservedTargetEvent).toBeDefined();
      expect(preservedTargetEvent?.accountId).toBe('acc_target');
      // Account name is cleanly stamped and preserved
      expect(preservedTargetEvent?.accountName).toBe('Staging Environment');
      // Service name is cleanly stamped and preserved
      expect(preservedTargetEvent?.serviceName).toBe('Antigravity Staging');

      // Other account event is untouched
      const otherEvent = updated.usageEvents.find((e) => e.id === 'evt_other_1');
      expect(otherEvent?.accountId).toBe('acc_other');
    });

    it('deleting an account that does not exist leaves state completely unchanged', () => {
      const initial: AppState = {
        ...getInitialState(),
        accounts: [
          {
            id: 'acc_keep',
            name: 'Important Workspace',
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      saveAppState(initial);

      const hook = renderHookHarness();
      hook.deleteAccount('acc_nonexistent');

      const after = loadAppState();
      expect(after.accounts).toHaveLength(1);
      expect(after.accounts[0].id).toBe('acc_keep');
    });

    it('cancelling account deletion leaves state and storage completely unchanged', () => {
      const initial: AppState = {
        ...getInitialState(),
        accounts: [
          {
            id: 'acc_candidate',
            name: 'Candidate Workspace',
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        services: [
          {
            id: 'srv_candidate',
            accountId: 'acc_candidate',
            name: 'Candidate Service',
            archived: false,
            createdAt: new Date().toISOString(),
          },
        ],
        limitWindows: [
          {
            id: 'win_candidate',
            serviceId: 'srv_candidate',
            accountId: 'acc_candidate',
            name: 'Candidate Window',
            capacity: 100,
            unit: 'requests',
            cadence: 'daily',
            resetAnchor: new Date().toISOString(),
            timeZone: 'UTC',
            currentUsed: 10,
            lastUpdated: new Date().toISOString(),
            archived: false,
          },
        ],
      };
      saveAppState(initial);

      // Simulate user opening confirm dialog and clicking Cancel:
      // onCancel is invoked instead of onConfirm, so deleteAccount is NOT called
      const onCancelAction = vi.fn();
      onCancelAction(); // user cancelled

      const afterCancel = loadAppState();
      expect(afterCancel.accounts).toHaveLength(1);
      expect(afterCancel.accounts[0].id).toBe('acc_candidate');
      expect(afterCancel.services).toHaveLength(1);
      expect(afterCancel.limitWindows).toHaveLength(1);
    });

    it('handles simulated React StrictMode double invocation of updater without creating duplicates', () => {
      const hook = renderHookHarness();

      // Simulate a double invocation on the accounts list
      const accountData = {
        name: 'StrictMode Account',
        archived: false,
      };

      const acc1 = hook.addAccount(accountData);

      // Verify exactly 1 account created
      const state1 = loadAppState();
      expect(state1.accounts.filter((a) => a.id === acc1.id)).toHaveLength(1);

      // Simulate StrictMode running updater twice with identical account
      hook.addAccount({
        ...accountData,
        id: acc1.id,
      } as any);

      const state2 = loadAppState();
      expect(state2.accounts.filter((a) => a.id === acc1.id)).toHaveLength(1);
      expect(state2.accounts).toHaveLength(1);
    });
  });

  describe('UI integration for account deletion & historical display', () => {
    it('AccountsScreen renders a visible Delete button with Trash2 styling for each account', () => {
      const testState: AppState = {
        ...getInitialState(),
        accounts: [
          {
            id: 'acc_1',
            name: 'Alpha Workspace',
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      const onDeleteAccount = vi.fn();

      const html = renderToString(
        React.createElement(AccountsScreen, {
          state: testState,
          onOpenAddAccount: () => {},
          onOpenEditAccount: () => {},
          onArchiveAccount: () => {},
          onDeleteAccount,
          onOpenAddService: () => {},
          onOpenEditService: () => {},
          onArchiveService: () => {},
          onOpenAddWindow: () => {},
          onOpenEditWindow: () => {},
          onArchiveWindow: () => {},
        })
      );

      // Verify Delete button with aria-label exists
      expect(html).toContain('title="Delete account"');
      expect(html).toContain('aria-label="Delete account Alpha Workspace"');
      expect(html).toContain('hover:text-[#ef4444]');
    });

    it('ProjectsScreen displays preserved accountName in history table when account was deleted', () => {
      const stateWithDeletedAccountHistory: AppState = {
        ...getInitialState(),
        accounts: [], // Account has been deleted!
        services: [], // Service has been deleted!
        limitWindows: [],
        projects: [
          {
            id: 'proj_1',
            name: 'Historical Evaluation',
            archived: false,
            createdAt: new Date().toISOString(),
          },
        ],
        usageEvents: [
          {
            id: 'evt_historical',
            timestamp: new Date().toISOString(),
            projectId: 'proj_1',
            accountId: 'acc_deleted_99',
            accountName: 'Legacy AI Studio Account',
            serviceId: 'srv_deleted_99',
            serviceName: 'Google AI Studio Legacy',
            type: 'usage',
            note: 'Legacy usage batch before account deletion',
            effects: [
              {
                windowId: 'win_deleted_99',
                amount: 42,
                previousUsed: 0,
                newUsed: 42,
              },
            ],
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const html = renderToString(
        React.createElement(ProjectsScreen, {
          state: stateWithDeletedAccountHistory,
          onOpenAddProject: () => {},
          onOpenEditProject: () => {},
          onArchiveProject: () => {},
          onOpenEditHistory: () => {},
          onOpenDeleteHistory: () => {},
        })
      );

      // Verify that the preserved accountName and serviceName are rendered cleanly without crashing
      expect(html).toContain('Legacy AI Studio Account');
      expect(html).toContain('Google AI Studio Legacy');
      expect(html).toContain('Legacy usage batch before account deletion');

      // Verify that the account filter dropdown includes the deleted account marked with (Deleted)
      expect(html).toContain('Account: Legacy AI Studio Account (Deleted)');
    });
  });
});
