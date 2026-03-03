import { ViewpointData } from './viewpoints-manager';

export interface ViewpointIndexItem {
    id: string;
    title: string;
    description: string;
    category: string;
    userId: string;
    date: number;
    file: string; // Path to full JSON file
}

export class ViewpointRepository {
    private _indexUrl: string = 'VISTAS/index.json';
    private _viewpoints: ViewpointIndexItem[] = [];

    constructor() {
        console.log('[Repository] Initialized');
    }

    /**
     * Loads the index of available viewpoints from the repository.
     */
    async loadIndex(): Promise<ViewpointIndexItem[]> {
        try {
            // Add timestamp to prevent caching
            const url = `${this._indexUrl}?t=${Date.now()}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn('[Repository] No viewpoints index found (VISTAS/index.json).');
                    return [];
                }
                throw new Error(`Failed to load index: ${response.statusText}`);
            }
            const data = await response.json();
            
            // Basic validation of index structure
            if (!Array.isArray(data)) {
                throw new Error('Invalid index format: expected an array.');
            }

            this._viewpoints = data;
            console.log(`[Repository] Loaded ${this._viewpoints.length} viewpoints from repository.`);
            return this._viewpoints;
        } catch (e) {
            console.error('[Repository] Error loading index:', e);
            return [];
        }
    }

    /**
     * Fetches the full data for a specific viewpoint.
     * @param fileUrl Relative path to the JSON file (e.g., "VISTAS/view-123.json")
     */
    async loadViewpointData(fileUrl: string): Promise<ViewpointData | null> {
        try {
            // Prevent caching for individual files too
            const url = `${fileUrl}?t=${Date.now()}`;
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
