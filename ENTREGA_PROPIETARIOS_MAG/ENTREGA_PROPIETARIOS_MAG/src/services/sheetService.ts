import { API_CONFIG } from '../config';

export interface SheetData {
  towerId: number | string;
  aptNumber: string;
  status: string;
  weeklyGoalDate?: string | null;
}

const jsonpRequest = async <T>(url: string, timeoutMs: number = 20000): Promise<T> => {
  const callbackName = `__gas_jsonp_cb_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const src = url.includes('?') ? `${url}&callback=${callbackName}` : `${url}?callback=${callbackName}`;

  return new Promise<T>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');

    const cleanup = () => {
      try {
        delete w[callbackName];
      } catch {}
      script.remove();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeoutMs);

    w[callbackName] = (data: unknown) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(data as T);
    };

    script.async = true;
    script.src = src;
    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('JSONP load error'));
    };

    document.head.appendChild(script);
  });
};

export const fetchSheetData = async (): Promise<SheetData[] | null> => {
  if (!API_CONFIG.scriptUrl) {
    console.warn('Google Apps Script URL not configured. Using local data.');
    return null;
  }

  const cacheBustedUrl = API_CONFIG.scriptUrl.includes('?')
    ? `${API_CONFIG.scriptUrl}&_ts=${Date.now()}`
    : `${API_CONFIG.scriptUrl}?_ts=${Date.now()}`;

  try {
    const data = await jsonpRequest<{ towers?: SheetData[]; error?: string }>(cacheBustedUrl);
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

  const url = API_CONFIG.scriptUrl.includes('?')
    ? `${API_CONFIG.scriptUrl}&action=sync&_ts=${Date.now()}`
    : `${API_CONFIG.scriptUrl}?action=sync&_ts=${Date.now()}`;

  try {
    const data = await jsonpRequest<{ ok?: boolean; error?: string }>(url);
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
