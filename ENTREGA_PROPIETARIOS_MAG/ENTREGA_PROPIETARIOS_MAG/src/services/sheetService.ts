import { API_CONFIG } from '../config';

export interface SheetData {
  towerId: number | string;
  aptNumber: string;
  status: string;
  weeklyGoalDate?: string | null;
}

export const fetchSheetData = async (): Promise<SheetData[] | null> => {
  if (!API_CONFIG.scriptUrl) {
    console.warn('Google Apps Script URL not configured. Using local data.');
    return null;
  }

  try {
    const cacheBustedUrl =
      API_CONFIG.scriptUrl.includes('?')
        ? `${API_CONFIG.scriptUrl}&_ts=${Date.now()}`
        : `${API_CONFIG.scriptUrl}?_ts=${Date.now()}`;

    const response = await fetch(cacheBustedUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    // The GAS script returns { towers: [...] } based on our implementation
    return data.towers || []; 
  } catch (error) {
    console.error('Error fetching data from Google Sheets:', error);
    return null;
  }
};

export const triggerSync = async (): Promise<boolean> => {
  if (!API_CONFIG.scriptUrl) return false;

  try {
    const url = API_CONFIG.scriptUrl.includes('?')
      ? `${API_CONFIG.scriptUrl}&action=sync&_ts=${Date.now()}`
      : `${API_CONFIG.scriptUrl}?action=sync&_ts=${Date.now()}`;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return false;
    await response.json().catch(() => null);
    return true;
  } catch {
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
    // We use no-cors mode as a fallback if CORS is strict, but ideally we want 'cors'
    // GAS web apps deployed as "Anyone" support CORS.
    const response = await fetch(API_CONFIG.scriptUrl, {
      method: 'POST',
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

    if (!response.ok) {
       // If opaque response in no-cors, we won't see this.
       // But assuming standard setup.
       console.warn('Update request might have failed', response.status);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating status in Google Sheets:', error);
    return false;
  }
};
