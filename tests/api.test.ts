import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchRemoteState,
  fetchRemoteMeta,
  pushRemoteState,
} from '../src/storage/api';
import { getInitialState } from '../src/storage/storage';

describe('Storage API Client (api.ts)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('fetchRemoteState', () => {
    it('returns remote state payload on HTTP 200 with valid data', async () => {
      const mockState = getInitialState();
      mockState.accounts.push({
        id: 'acc_1',
        name: 'Main Production Account',
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const mockResponse = {
        state: mockState,
        revision: 5,
        updatedAt: '2026-11-05T07:00:00.000Z',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await fetchRemoteState();
      expect(result).not.toBeNull();
      expect(result?.revision).toBe(5);
      expect(result?.state.accounts).toHaveLength(1);
      expect(result?.state.accounts[0].name).toBe('Main Production Account');
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/state', expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      }));
    });

    it('returns null when HTTP status is not 200 (e.g. 500 or 404)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database connection failed' }),
      } as Response);

      const result = await fetchRemoteState();
      expect(result).toBeNull();
    });

    it('returns null on network failure / offline rejection', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline or ECONNREFUSED'));

      const result = await fetchRemoteState();
      expect(result).toBeNull();
    });

    it('returns null when response payload is malformed or missing state', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalid: true }),
      } as Response);

      const result = await fetchRemoteState();
      expect(result).toBeNull();
    });
  });

  describe('fetchRemoteMeta', () => {
    it('returns remote metadata on HTTP 200', async () => {
      const mockMeta = {
        revision: 12,
        updatedAt: '2026-11-05T07:10:00.000Z',
        hasData: true,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockMeta,
      } as Response);

      const result = await fetchRemoteMeta();
      expect(result).not.toBeNull();
      expect(result?.revision).toBe(12);
      expect(result?.hasData).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/state/meta', expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      }));
    });

    it('returns null on HTTP error or network failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      } as Response);

      const result = await fetchRemoteMeta();
      expect(result).toBeNull();

      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const result2 = await fetchRemoteMeta();
      expect(result2).toBeNull();
    });
  });

  describe('pushRemoteState', () => {
    it('sends POST /api/state with JSON body and returns confirmation payload', async () => {
      const stateToPush = getInitialState();
      const mockResponse = {
        ok: true,
        revision: 7,
        updatedAt: '2026-11-05T07:15:00.000Z',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await pushRemoteState(stateToPush);
      expect(result).not.toBeNull();
      expect(result?.ok).toBe(true);
      expect(result?.revision).toBe(7);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/state', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ state: stateToPush }),
      }));
    });

    it('returns null when server responds with an error status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid state payload' }),
      } as Response);

      const result = await pushRemoteState(getInitialState());
      expect(result).toBeNull();
    });

    it('returns null gracefully when push encounters network timeout or offline exception', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection reset by peer'));

      const result = await pushRemoteState(getInitialState());
      expect(result).toBeNull();
    });
  });
});
