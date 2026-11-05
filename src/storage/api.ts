import { AppState } from '../domain/types';

export interface RemoteStateResponse {
  state: AppState;
  revision: number;
  updatedAt: string;
}

export interface RemoteMetaResponse {
  revision: number;
  updatedAt: string;
  hasData: boolean;
}

export interface PushStateResponse {
  ok: boolean;
  revision: number;
  updatedAt: string;
}

const DEFAULT_TIMEOUT_MS = 5000;

function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

/**
 * Fetches the entire shared application state from the central database.
 * Returns null if network fails, status is not 200, or timeout occurs.
 */
export async function fetchRemoteState(
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<RemoteStateResponse | null> {
  const { signal, cleanup } = createTimeoutSignal(timeoutMs);
  try {
    const response = await fetch('/api/state', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      console.warn(`[Remote API] fetchRemoteState failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data || typeof data !== 'object' || !data.state) {
      console.warn('[Remote API] fetchRemoteState returned invalid response payload');
      return null;
    }

    return data as RemoteStateResponse;
  } catch (error) {
    console.warn(
      '[Remote API] fetchRemoteState encountered network or timeout error:',
      error instanceof Error ? error.message : error
    );
    return null;
  } finally {
    cleanup();
  }
}

/**
 * Fetches state metadata (revision, updatedAt, hasData) for lightweight change detection.
 * Returns null if network fails, status is not 200, or timeout occurs.
 */
export async function fetchRemoteMeta(
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<RemoteMetaResponse | null> {
  const { signal, cleanup } = createTimeoutSignal(timeoutMs);
  try {
    const response = await fetch('/api/state/meta', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      console.warn(`[Remote API] fetchRemoteMeta failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data || typeof data !== 'object' || typeof data.revision !== 'number') {
      console.warn('[Remote API] fetchRemoteMeta returned invalid response payload');
      return null;
    }

    return data as RemoteMetaResponse;
  } catch (error) {
    console.warn(
      '[Remote API] fetchRemoteMeta encountered network or timeout error:',
      error instanceof Error ? error.message : error
    );
    return null;
  } finally {
    cleanup();
  }
}

/**
 * Pushes the full application state to the shared backend database.
 * Returns { ok, revision, updatedAt } on success, or null if network error or timeout occurs.
 */
export async function pushRemoteState(
  state: AppState,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<PushStateResponse | null> {
  const { signal, cleanup } = createTimeoutSignal(timeoutMs);
  try {
    const response = await fetch('/api/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ state }),
      signal,
    });

    if (!response.ok) {
      console.warn(`[Remote API] pushRemoteState failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data || typeof data !== 'object' || !data.ok) {
      console.warn('[Remote API] pushRemoteState returned unexpected payload:', data);
      return null;
    }

    return data as PushStateResponse;
  } catch (error) {
    console.warn(
      '[Remote API] pushRemoteState encountered network or timeout error:',
      error instanceof Error ? error.message : error
    );
    return null;
  } finally {
    cleanup();
  }
}
