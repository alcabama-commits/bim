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

const SCRIPT_URL_STORAGE_KEY = 'entrega_propi_mag:scriptUrl';
const FALLBACK_SCRIPT_URLS = [
  'https://script.google.com/macros/s/AKfycbxDXc7XldGCnbVMlR0FfQg7HrHBI3Ux2t2_wC1AdGitFy5d82Lca6YFd309nLKj7tI/exec',
];

const readStoredScriptUrl = (): string | null => {
  try {
    const v = localStorage.getItem(SCRIPT_URL_STORAGE_KEY);
    const s = String(v ?? '').trim();
    return s ? s : null;
  } catch {
    return null;
  }
};

const writeStoredScriptUrl = (url: string) => {
  try {
    localStorage.setItem(SCRIPT_URL_STORAGE_KEY, url);
  } catch {
  }
};

const getCandidateScriptUrls = (): string[] => {
  const raw: Array<string | null | undefined> = [readStoredScriptUrl(), API_CONFIG.scriptUrl, ...FALLBACK_SCRIPT_URLS];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of raw) {
    const s = String(u ?? '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
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
      reject(new Error(`JSONP timeout: ${script.src || url.toString()}`));
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
      reject(new Error(`JSONP load error: ${script.src || url.toString()}`));
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

const requestFromAnyScriptUrl = async <T>(
  buildUrl: (base: string) => URL,
  options?: JsonpOptions & { retries?: number },
): Promise<{ data: T; scriptUrl: string }> => {
  const candidates = getCandidateScriptUrls();
  let lastErr: unknown = null;
  for (const base of candidates) {
    try {
      const url = buildUrl(base);
      const data = await jsonpRequestWithRetry<T>(url, options);
      if (base !== API_CONFIG.scriptUrl) writeStoredScriptUrl(base);
      return { data, scriptUrl: base };
    } catch (e) {
      lastErr = e;
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
    const { data } = await requestFromAnyScriptUrl<{ towers?: SheetData[]; error?: string }>((base) => {
      const url = new URL(base);
      url.searchParams.set('_ts', String(Date.now()));
      return url;
    }, { timeoutMs: 45000, retries: 3 });
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
    const { data } = await requestFromAnyScriptUrl<{ ok?: boolean; error?: string }>((base) => {
      const u = new URL(base);
      u.searchParams.set('action', 'sync');
      u.searchParams.set('_ts', String(Date.now()));
      return u;
    }, { timeoutMs: 45000, retries: 3 });
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
  const base = readStoredScriptUrl() || API_CONFIG.scriptUrl;
  if (!base) {
    console.warn('Google Apps Script URL not configured. Change not saved to sheet.');
    return true; // Simulate success so UI updates even without backend
  }

  if (String(status).trim().toLowerCase() === 'notarized') {
    return false;
  }

  try {
    const response = await fetch(base, {
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
