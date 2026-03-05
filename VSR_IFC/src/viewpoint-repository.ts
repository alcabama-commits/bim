import { ViewpointData } from './viewpoints-manager';
import { VIEWPOINTS_API_URL } from './config';

export interface ViewpointIndexItem {
    id: string;
    title: string;
    description: string;
    category: string;
    userId: string;
    date: number;
    file: string; // Path to full JSON file or URL
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
    async loadIndex(): Promise<ViewpointIndexItem[]> {
        let cloudData: ViewpointIndexItem[] = [];
        
        // 1. Try Cloud
        if (VIEWPOINTS_API_URL) {
            try {
                const response = await fetch(`${VIEWPOINTS_API_URL}?action=list`);
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
    async loadViewpointData(fileUrl: string): Promise<ViewpointData | null> {
        try {
            // Check if it's a full URL (cloud) or relative path
            let url = fileUrl;
            if (!fileUrl.startsWith('http')) {
                 url = `${fileUrl}?t=${Date.now()}`;
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
    async saveViewpointToCloud(viewpoint: ViewpointData): Promise<boolean> {
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
                    data: viewpoint
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
}
