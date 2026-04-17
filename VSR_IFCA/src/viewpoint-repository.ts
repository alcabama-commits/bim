import { ViewpointData } from './viewpoints-manager';
import { AUTHORIZED_USERS_SHEET_GID, AUTHORIZED_USERS_SHEET_ID, VIEWPOINTS_API_URL } from './config';

export interface ViewpointIndexItem {
    id: string;
    title: string;
    description: string;
    category: string;
    userId: string;
    date: number;
    file: string; // Path to full JSON file or URL
    sharedWith?: string[];
}

export interface ActiveUser {
    id: string;
    name: string;
    email?: string;
}

export class ViewpointRepository {
    private _indexUrl: string = 'VIEWS/index.json';
    private _viewpoints: ViewpointIndexItem[] = [];

    constructor() {
        console.log('[Repository] Initialized');
        if (VIEWPOINTS_API_URL) {
            console.log('[Repository] Cloud API configured:', VIEWPOINTS_API_URL);
        }
    }

    /**
     * Loads the index of available viewpoints from the repository.
     * Tries cloud first if configured, falls back to local static file.
     */
    async loadIndex(userId?: string): Promise<ViewpointIndexItem[]> {
        let cloudData: ViewpointIndexItem[] = [];
        
        // 1. Try Cloud
        if (VIEWPOINTS_API_URL) {
            try {
                // Add timestamp to prevent caching
                const userQuery = userId ? `&userId=${encodeURIComponent(userId)}` : '';
                const response = await fetch(`${VIEWPOINTS_API_URL}?action=list${userQuery}&t=${Date.now()}`);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        console.log(`[Repository] Loaded ${data.length} viewpoints from Cloud.`);
                        cloudData = data;
                    }
                }
            } catch (e) {
                console.warn('[Repository] Cloud load failed, falling back to local:', e);
            }
        }

        // 2. Try Local/Static
        try {
            // Add timestamp to prevent caching
            const url = `${this._indexUrl}?t=${Date.now()}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const localData = await response.json();
                if (Array.isArray(localData)) {
                     console.log(`[Repository] Loaded ${localData.length} viewpoints from Local.`);
                     // Merge strategies could be complex, for now let's prioritize Cloud if available,
                     // or merge by ID.
                     // Simple merge: Add local items that aren't in cloud.
                     const cloudIds = new Set(cloudData.map(i => i.id));
                     for (const item of localData) {
                         if (!cloudIds.has(item.id)) {
                             cloudData.push(item);
                         }
                     }
                }
            }
        } catch (e) {
            console.warn('[Repository] Local index load failed:', e);
        }

        this._viewpoints = cloudData;
        return this._viewpoints;
    }

    /**
     * Fetches the full data for a specific viewpoint.
     * @param fileUrl Relative path or full URL to the JSON file
     */
    async loadViewpointData(fileUrl: string, userId?: string): Promise<ViewpointData | null> {
        try {
            // Check if it's a full URL (cloud) or relative path
            let url = fileUrl;
            // Append timestamp for cache busting
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}t=${Date.now()}`;
            if (userId && !url.includes('userId=')) {
                url += `&userId=${encodeURIComponent(userId)}`;
            }

            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to load view file: ${fileUrl}`);
            }
            const data = await response.json();
            
            if (this.validateViewpointData(data)) {
                return data;
            } else {
                console.error(`[Repository] Invalid viewpoint data in ${fileUrl}`);
                return null;
            }
        } catch (e) {
            console.error(`[Repository] Error loading view ${fileUrl}:`, e);
            return null;
        }
    }

    /**
     * Saves a viewpoint to the cloud via Google Apps Script.
     */
    async saveViewpointToCloud(viewpoint: ViewpointData, requesterUserId?: string): Promise<boolean> {
        if (!VIEWPOINTS_API_URL) {
            console.warn('[Repository] No Cloud API URL configured.');
            return false;
        }

        try {
            // We use no-cors mode usually for GAS if we don't need response, 
            // but we might want to know if it succeeded. 
            // GAS Web App needs to return JSON with correct CORS headers.
            const response = await fetch(VIEWPOINTS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8', // GAS handles text/plain better usually to avoid preflight options issues sometimes
                },
                body: JSON.stringify({
                    action: 'save',
                    data: viewpoint,
                    requesterUserId
                })
            });

            if (!response.ok) {
                throw new Error(`Cloud save failed: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                console.log('[Repository] Saved to cloud successfully.');
                return true;
            } else {
                throw new Error(result.message || 'Unknown error from server');
            }
        } catch (e) {
            console.error('[Repository] Error saving to cloud:', e);
            return false;
        }
    }

    /**
     * Deletes a viewpoint from the cloud via Google Apps Script.
     */
    async deleteViewpointFromCloud(id: string): Promise<boolean> {
        if (!VIEWPOINTS_API_URL) {
            console.warn('[Repository] No Cloud API URL configured.');
            return false;
        }

        try {
            console.log(`[Repository] Deleting viewpoint ${id} from cloud...`);
            const response = await fetch(VIEWPOINTS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({
                    action: 'delete',
                    id: id
                })
            });

            if (!response.ok) {
                throw new Error(`Cloud delete failed: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                console.log('[Repository] Deleted from cloud successfully.');
                return true;
            } else {
                throw new Error(result.message || 'Unknown error from server');
            }
        } catch (e) {
            console.error('[Repository] Error deleting from cloud:', e);
            return false;
        }
    }

    /**
     * Validates that the loaded JSON matches the expected ViewpointData structure.
     */
    private validateViewpointData(data: any): data is ViewpointData {
        if (!data || typeof data !== 'object') return false;
        
        const requiredFields = ['id', 'userId', 'title', 'camera'];
        for (const field of requiredFields) {
            if (!(field in data)) {
                console.warn(`[Repository] Validation failed: missing field '${field}'`);
                return false;
            }
        }

        // Deep validation for camera
        if (!data.camera || !Array.isArray(data.camera.position) || !Array.isArray(data.camera.target)) {
             console.warn(`[Repository] Validation failed: invalid camera structure`);
             return false;
        }

        return true;
    }

    /**
     * Helper to trigger a download of the viewpoint data as a JSON file.
     * Users can then commit this file to the repository.
     */
    exportViewpoint(viewpoint: ViewpointData) {
        const json = JSON.stringify(viewpoint, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        // Sanitize filename
        const safeTitle = viewpoint.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `viewpoint-${safeTitle}-${viewpoint.id.substring(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    private normalizeActiveUsers(rawUsers: any[]): ActiveUser[] {
        const normalized = rawUsers
            .map((u: any) => {
                if (u && typeof u === 'object') {
                    const id = String(
                        u.id ??
                        u.userId ??
                        u.user_id ??
                        u.email ??
                        u.correo ??
                        u.mail ??
                        ''
                    ).trim();
                    const emailRaw = u.email ?? u.correo ?? u.mail ?? u['e-mail'];
                    const email = emailRaw ? String(emailRaw).trim().toLowerCase() : undefined;
                    const name = String(
                        u.name ??
                        u.nombre ??
                        u.displayName ??
                        u.display_name ??
                        u.usuario ??
                        email ??
                        id
                    ).trim();
                    return { id, name, email };
                }
                const v = String(u ?? '').trim();
                return v ? { id: v, name: v } : null;
            })
            .filter((u): u is ActiveUser => !!u && !!u.id);

        const deduped = new Map<string, ActiveUser>();
        for (const user of normalized) {
            const key = user.id.trim().toLowerCase();
            if (!key) continue;
            if (!deduped.has(key)) deduped.set(key, user);
        }
        return Array.from(deduped.values());
    }

    private parseGoogleVisualizationUsers(rawText: string): ActiveUser[] {
        const start = rawText.indexOf('{');
        const end = rawText.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) {
            throw new Error('Respuesta inválida de Google Sheets.');
        }

        const payload = JSON.parse(rawText.slice(start, end + 1));
        const rows = payload?.table?.rows;
        if (!Array.isArray(rows) || rows.length === 0) return [];

        const matrix = rows.map((row: any) =>
            Array.isArray(row?.c) ? row.c.map((cell: any) => cell?.v ?? '') : []
        );
        if (matrix.length === 0) return [];

        const header = matrix[0].map((value: any) => String(value || '').trim().toLowerCase());
        const findCol = (candidates: string[]) => {
            for (const candidate of candidates) {
                const idx = header.indexOf(candidate);
                if (idx !== -1) return idx;
            }
            return -1;
        };

        const colEmail = findCol(['email', 'correo', 'mail', 'e-mail']);
        const colName = findCol(['nombre', 'name', 'usuario', 'displayname', 'display_name']);
        const colRole = findCol(['rol', 'role', 'roles']);
        if (colEmail === -1 && colName === -1) {
            throw new Error('La hoja no contiene columnas de usuario reconocibles.');
        }

        const users: ActiveUser[] = [];
        for (let i = 1; i < matrix.length; i++) {
            const row = matrix[i];
            const email = colEmail !== -1 ? String(row[colEmail] || '').trim().toLowerCase() : '';
            const name = colName !== -1 ? String(row[colName] || '').trim() : '';
            const role = colRole !== -1 ? String(row[colRole] || '').trim() : '';
            const id = email || name;
            if (!id) continue;
            users.push({
                id,
                name: name || email || id,
                email: email || undefined
            });
            if (role) {
                // role is currently ignored in UI, but keeping the parse makes the source resilient.
            }
        }

        return this.normalizeActiveUsers(users);
    }

    private async loadActiveUsersFromSheetDirect(): Promise<ActiveUser[]> {
        if (!AUTHORIZED_USERS_SHEET_ID) return [];
        const url = `https://docs.google.com/spreadsheets/d/${AUTHORIZED_USERS_SHEET_ID}/gviz/tq?tqx=out:json&gid=${AUTHORIZED_USERS_SHEET_GID}&t=${Date.now()}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Google Sheets respondió HTTP ${response.status}`);
        }
        const text = await response.text();
        return this.parseGoogleVisualizationUsers(text);
    }

    async loadActiveUsers(): Promise<ActiveUser[]> {
        const errors: string[] = [];

        if (VIEWPOINTS_API_URL) {
            try {
                const response = await fetch(`${VIEWPOINTS_API_URL}?action=users&t=${Date.now()}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (data && typeof data === 'object' && !Array.isArray(data) && data.status === 'error') {
                    throw new Error(String(data.message || 'No se pudo cargar la lista de usuarios.'));
                }
                if (data && typeof data === 'object' && !Array.isArray(data) && typeof (data as any).warning === 'string' && (data as any).warning.trim()) {
                    throw new Error(String((data as any).warning));
                }
                const rawUsers = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.users)
                        ? data.users
                        : Array.isArray(data?.data)
                            ? data.data
                            : [];

                if (Array.isArray(rawUsers)) {
                    const users = this.normalizeActiveUsers(rawUsers);
                    if (users.length > 0) return users;
                }
                errors.push('La API no devolvió usuarios.');
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                console.warn('[Repository] Failed to load users list from API:', e);
                errors.push(`API: ${message}`);
            }
        }

        try {
            const directUsers = await this.loadActiveUsersFromSheetDirect();
            if (directUsers.length > 0) return directUsers;
            errors.push('La hoja no devolvió usuarios.');
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.warn('[Repository] Failed to load users list from Google Sheet:', e);
            errors.push(`Google Sheet: ${message}`);
        }

        throw new Error(errors.join(' | ') || 'No se pudo cargar la lista de usuarios autorizados.');
    }

    async shareViewpointToCloud(id: string, requesterUserId: string, sharedWith: string[]): Promise<{ ok: boolean; message?: string }> {
        if (!VIEWPOINTS_API_URL) {
            return { ok: false, message: 'VIEWPOINTS_API_URL no configurada.' };
        }

        try {
            const formBody = new URLSearchParams();
            formBody.set('action', 'share');
            formBody.set('id', id);
            formBody.set('userId', requesterUserId);
            formBody.set('sharedWith', (sharedWith || []).join(';'));

            const response = await fetch(VIEWPOINTS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                },
                body: formBody.toString()
            });

            const raw = await response.text();
            let result: any = null;
            try {
                result = JSON.parse(raw);
            } catch {
                result = null;
            }

            if (!response.ok) {
                const msg = result?.message ? String(result.message) : `HTTP ${response.status}`;
                return { ok: false, message: msg };
            }
            if (!result || typeof result !== 'object') {
                return { ok: false, message: 'Respuesta inválida del servidor.' };
            }
            if (result.status === 'success') return { ok: true };
            return { ok: false, message: String(result.message || 'No se pudo compartir la vista.') };
        } catch (e) {
            console.error('[Repository] Error sharing viewpoint to cloud:', e);
            return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
    }
}
