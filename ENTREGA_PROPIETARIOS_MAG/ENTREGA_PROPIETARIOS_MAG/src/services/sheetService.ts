import { API_CONFIG } from '../config';

export interface SheetData {
  towerId: number | string;
  aptNumber: string;
  status: string;
  weeklyGoalDate?: string | null;
}

type JsonpOptions = {
  timeoutMs?: number;
};

const jsonpRequest = async <T>(url: URL, options?: JsonpOptions): Promise<T> => {
  const timeoutMs = typeof options?.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 45000;
  const callbackName = `__gas_jsonp_cb_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  url.searchParams.set('callback', callbackName);
  url.searchParams.set('_', `${Date.now()}_${Math.random().toString(16).slice(2)}`);

  return new Promise<T>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');

    let settled = false;
    const cleanup = () => {
      try {
        delete w[callbackName];
      } catch {
        w[callbackName] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeoutMs);

    w[callbackName] = (data: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(data as T);
    };

    script.async = true;
    try { (script as any).referrerPolicy = 'no-referrer'; } catch {}
    script.src = url.toString();
    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('JSONP load error'));
    };

    document.head.appendChild(script);
  });
};

const jsonpRequestWithRetry = async <T>(url: URL, options?: JsonpOptions & { retries?: number }): Promise<T> => {
  const retries = typeof options?.retries === 'number' && Number.isFinite(options.retries) ? Math.max(1, Math.floor(options.retries)) : 3;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await jsonpRequest<T>(new URL(url.toString()), options);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error('JSONP load error'));
};

export const fetchSheetData = async (): Promise<SheetData[] | null> => {
  if (!API_CONFIG.scriptUrl) {
    console.warn('Google Apps Script URL not configured. Using local data.');
    return null;
  }

  try {
    const url = new URL(API_CONFIG.scriptUrl);
    url.searchParams.set('_ts', String(Date.now()));
    const data = await jsonpRequestWithRetry<{ towers?: SheetData[]; error?: string }>(url, { timeoutMs: 45000, retries: 3 });
    if (data && typeof data === 'object' && typeof (data as any).error === 'string' && String((data as any).error).trim()) {
      throw new Error(String((data as any).error));
    }
    return data.towers || [];
  } catch (error) {
    console.error('Error fetching data from Google Sheets (JSONP):', error);
    return null;
  }
};

export const triggerSync = async (): Promise<boolean> => {
  if (!API_CONFIG.scriptUrl) return false;

  try {
    const u = new URL(API_CONFIG.scriptUrl);
    u.searchParams.set('action', 'sync');
    u.searchParams.set('_ts', String(Date.now()));
    const data = await jsonpRequestWithRetry<{ ok?: boolean; error?: string }>(u, { timeoutMs: 45000, retries: 3 });
    if (data && typeof data === 'object' && typeof (data as any).error === 'string' && String((data as any).error).trim()) {
      return false;
    }
    if (data && typeof data === 'object' && typeof (data as any).ok === 'boolean') return Boolean((data as any).ok);
    return true;
  } catch (error) {
    console.error('Error triggering sync (JSONP):', error);
    return false;
  }
};

export const updateSheetStatus = async (towerId: number, aptNumber: string, status: string, weeklyGoalDate?: string | null): Promise<boolean> => {
  if (!API_CONFIG.scriptUrl) {
    console.warn('Google Apps Script URL not configured. Change not saved to sheet.');
    return true; // Simulate success so UI updates even without backend
  }

  if (String(status).trim().toLowerCase() === 'notarized') {
    return false;
  }

  try {
    const response = await fetch(API_CONFIG.scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // GAS prefers text/plain to avoid preflight
      },
      body: JSON.stringify({
        action: 'update',
        towerId,
        aptNumber,
        status,
        weeklyGoalDate: status === 'weekly_goal' ? (weeklyGoalDate ?? null) : null
      })
    });

    void response;
    return true;
  } catch (error) {
    console.error('Error updating status in Google Sheets:', error);
    return false;
  }
};
