import axios from 'axios';

// Absolute URL — never rely on relative paths in Electron/Vite hybrid
export const API_BASE_URL = 'http://127.0.0.1:8000/api';
const BACKEND_ROOT = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const ACTIVE_SESSION_KEY = 'omni-active-session';
export const ACTIVE_SESSION_EVENT = 'omni-active-session-change';

function getUserEmailHeader() {
  const email = localStorage.getItem('omni-email');
  return email ? { 'X-User-Email': email } : {};
}

api.interceptors.request.use((config) => {
  config.headers = {
    ...(config.headers || {}),
    ...getUserEmailHeader(),
  };
  return config;
});

// Normalize Axios error messages for display (no auth interceptor)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
      error.userMessage = 'Cannot connect to backend. Make sure the server is running on port 8000.';
    } else if (error.response?.data?.detail) {
      error.userMessage = error.response.data.detail;
    } else {
      error.userMessage = error.message || 'An unexpected error occurred.';
    }
    return Promise.reject(error);
  }
);

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extract a human-readable error message from any error type.
 * Works for Axios errors, native fetch errors, and plain Error objects.
 */
export function extractErrorMessage(error) {
  if (error?.userMessage) return error.userMessage;
  if (error?.response?.data?.detail) return error.response.data.detail;
  if (error?.message === 'Failed to fetch') {
    return 'Cannot connect to backend (port 8000). The server may still be starting — please wait a moment and try again.';
  }
  return error?.message || 'An unexpected error occurred.';
}

export function getActiveSessionId() {
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function setActiveSessionId(sessionId) {
  if (sessionId) localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  else localStorage.removeItem(ACTIVE_SESSION_KEY);
  window.dispatchEvent(new CustomEvent(ACTIVE_SESSION_EVENT, { detail: { sessionId: sessionId || null } }));
}

/**
 * Retry an async function up to maxRetries times with a delay between attempts.
 */
async function withRetry(fn, maxRetries = 3, delayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isNetwork =
        err?.message === 'Failed to fetch' ||
        err?.code === 'ECONNREFUSED' ||
        err?.message === 'Network Error';

      if (isNetwork && attempt < maxRetries) {
        console.warn(`[api] Retry ${attempt}/${maxRetries} after network error. Waiting ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

// ── Auth API (stub — JWT disabled for testing) ─────────────────────────────────
export const authApi = {
  login: async () => ({ email: 'test@local' }),
  register: async () => ({ email: 'test@local' }),
  me: async () => ({ email: localStorage.getItem('omni-email') || 'test@local' }),
  logout: () => {
    localStorage.removeItem('omni-email');
    localStorage.removeItem('omni-chat-backup');
  }
};

// ── Health Check ───────────────────────────────────────────────────────────────
export const healthApi = {
  /**
   * Check if the backend is reachable.
   * Returns true if healthy, false otherwise (never throws).
   */
  check: async () => {
    try {
      const res = await fetch(`${BACKEND_ROOT}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
};

// ── Document API ───────────────────────────────────────────────────────────────
export const documentApi = {
  upload: async (file, sessionId, onProgress) => {
    return withRetry(async () => {
      if (!sessionId) {
        throw new Error('Please create or open a session before uploading.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', sessionId);

      // XMLHttpRequest for upload progress (fetch doesn't support upload progress events)
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/documents/upload`);
        const email = localStorage.getItem('omni-email');
        if (email) {
          xhr.setRequestHeader('X-User-Email', email);
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
          } else {
            let detail = `Upload failed (HTTP ${xhr.status})`;
            try { detail = JSON.parse(xhr.responseText)?.detail || detail; } catch { /* noop */ }
            const err = new Error(detail);
            err.status = xhr.status;
            reject(err);
          }
        };

        xhr.onerror = () => reject(new Error('Failed to fetch'));
        xhr.ontimeout = () => reject(new Error('Upload timed out. Extreme OCR processes may take several minutes.'));
        xhr.timeout = 300000; // 5 minutes
        xhr.send(formData);
      });
    }, 3, 1500);
  },

  list: async (sessionId) => {
    const response = await api.get('/documents/', {
      params: sessionId ? { session_id: sessionId } : undefined,
    });
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  }
};

// ── Chat API ───────────────────────────────────────────────────────────────────
export const chatApi = {
  askStream: async (query, sessionId, onMessage, onCitations, onError, onComplete, signal) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getUserEmailHeader(),
        },
        body: JSON.stringify({ query, session_id: sessionId }),
        signal,
      });

      if (!response.ok) {
        let detail = `Chat request failed (HTTP ${response.status})`;
        try { const data = await response.json(); detail = data.detail || detail; } catch { /* noop */ }
        throw new Error(detail);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      try {
        while (true) {
          if (signal?.aborted) { await reader.cancel(); break; }
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() || '';

          for (const block of blocks) {
            const blockLines = block.split(/\r?\n/);
            let eventType = null;
            let dataStr = '';
            for (const line of blockLines) {
              if (line.startsWith('event: ')) eventType = line.slice(7).trim();
              else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
            }
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                if (eventType === 'citations') onCitations(data);
                else if (eventType === 'message') onMessage(data);
              } catch { /* ignore malformed SSE frames */ }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      onComplete();
    } catch (e) {
      if (e.name === 'AbortError') return;
      e.message = extractErrorMessage(e);
      onError(e);
    }
  },

  getSessions: async () => {
    const response = await api.get('/chat/sessions');
    return response.data;
  },

  createSession: async (title) => {
    const response = await api.post('/chat/sessions', title ? { title } : {});
    return response.data;
  },

  renameSession: async (sessionId, title) => {
    const response = await api.put(`/chat/sessions/${sessionId}`, { title });
    return response.data;
  },

  getSessionMessages: async (sessionId) => {
    const response = await api.get(`/chat/${sessionId}`);
    return response.data;
  }
};

// ── Analytics API ──────────────────────────────────────────────────────────────
export const analyticsApi = {
  getStats: async () => {
    const response = await api.get('/analytics/');
    return response.data;
  }
};
