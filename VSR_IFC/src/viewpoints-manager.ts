import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import { ViewpointRepository } from './viewpoint-repository';
import type { ActiveUser } from './viewpoint-repository';

export interface ViewpointData {
    id: string;
    userId: string; // Foreign Key to User
    title: string;
    description: string;
    date: number;
    category: string;
    tags: string[];
    camera: {
        position: number[];
        target: number[];
        projection: string;
    };
    selection: { [fragmentID: string]: number[] };
    isolation: string[]; // GUIDs of isolated elements (Reserved for future use)
    hidden: { [modelUUID: string]: number[] }; // Map of Model UUID -> Array of ExpressIDs
    annotations: any[]; // Serialized measurements/annotations
    clippingPlanes: { normal: number[], constant: number }[]; // Serialized clipping planes
    loadedModels: { uuid: string, url: string }[]; // List of loaded models
    sharedWith?: string[]; // Emails/userIds that can access this viewpoint
}

export interface ViewpointStateProvider {
    getMeasurements(): any[];
    restoreMeasurements(data: any[]): void;
    getHiddenItems(): Record<string, number[]>;
    restoreHiddenItems(items: Record<string, number[]>): Promise<void> | void;
    getClippingPlanes(): { normal: number[], constant: number }[];
    restoreClippingPlanes(planes: { normal: number[], constant: number }[]): void;
    getLoadedModels(): { uuid: string, url: string }[];
    restoreLoadedModels(models: { uuid: string, url: string }[]): Promise<void> | void;
}

export class ViewpointsManager extends OBC.Component implements OBC.Disposable {
    static uuid = "ViewpointsManager-VSR-IFC";
    enabled = true;
    
    private _components: OBC.Components;
    private _world: OBC.World;
    private _viewpoints: OBC.Viewpoints;
    private _highlighter: OBF.Highlighter;
    private _hider: OBC.Hider;
    
    private _savedViewpoints: ViewpointData[] = [];
    private _stateProvider?: ViewpointStateProvider;
    private _currentUserId: string | null = null;

    // Repository
    private _repository: ViewpointRepository;
    
    // UI
    private _container: HTMLElement | null = null;
    private _listContainer: HTMLElement | null = null;

    constructor(components: OBC.Components, world: OBC.World, stateProvider?: ViewpointStateProvider) {
        super(components);
        this._components = components;
        this._world = world;
        this._stateProvider = stateProvider;
        
        // Get required components
        this._viewpoints = components.get(OBC.Viewpoints);
        this._viewpoints.world = world;
        
        this._highlighter = components.get(OBF.Highlighter);
        this._hider = components.get(OBC.Hider);
        
        this._repository = new ViewpointRepository();

        this.initializeUser();
        this.loadFromStorage();
        this.loadFromRepository();
    }

    private initializeUser() {
        // Middleware: Authenticate User
        try {
            const userStr = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount');
            if (userStr) {
                const user = JSON.parse(userStr);
                // Use email or unique identifier as UserID
                this._currentUserId = user.email || user.username || 'guest';
            } else {
                this._currentUserId = 'guest'; // Fallback
            }
        } catch (e) {
            console.error('Auth Middleware Error:', e);
            this._currentUserId = 'guest';
        }
    }

    // Middleware: Authorization Check
    // NOTE: In a serverless/local-first architecture, this method acts as the API Gateway/Middleware layer
    // ensuring that no operation proceeds without ownership validation.
    private checkOwnership(viewpoint: ViewpointData): boolean {
        if (!this._currentUserId || this._currentUserId === 'guest') return false;
        return viewpoint.userId === this._currentUserId;
    }

    setStateProvider(provider: ViewpointStateProvider) {
        this._stateProvider = provider;
    }

    private isCurrentUser(userId?: string | null) {
        if (!userId || !this._currentUserId) return false;
        return String(userId).trim().toLowerCase() === String(this._currentUserId).trim().toLowerCase();
    }

    private collectKnownUsers(): ActiveUser[] {
        const users = new Map<string, ActiveUser>();
        for (const view of this._savedViewpoints) {
            const rawId = String(view.userId || '').trim();
            if (!rawId) continue;
            const key = rawId.toLowerCase();
            if (this.isCurrentUser(rawId)) continue;
            if (!users.has(key)) {
                users.set(key, {
                    id: rawId,
                    name: rawId,
                    email: rawId.includes('@') ? rawId.toLowerCase() : undefined
                });
            }
        }
        return Array.from(users.values());
    }

    // --- Repository Integration ---

    async importViewpointFromFile(file: File) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Basic validation
            if (!data.id || !data.camera) {
                alert('El archivo no parece ser una vista válida (Faltan campos id o camera).');
                return;
            }

            // Check if exists
            const existingIdx = this._savedViewpoints.findIndex(v => v.id === data.id);
            if (existingIdx !== -1) {
                if (!confirm(`La vista "${data.title}" ya existe. ¿Deseas sobrescribirla?`)) {
                    return;
                }
                this._savedViewpoints[existingIdx] = data;
            } else {
                this._savedViewpoints.push(data);
            }
            
            // We save to local storage to keep it in the current session
            this.saveToStorage();
            this.renderList();
            alert(`Vista "${data.title}" importada correctamente.`);
        } catch (e) {
            console.error('[Viewpoints] Error importing viewpoint:', e);
            alert('Error al importar la vista. Verifique el formato del archivo JSON.');
        }
    }

    async loadFromRepository() {
        console.log('[Viewpoints] Loading from repository...');
        try {
            const index = await this._repository.loadIndex(this._currentUserId);
            
            if (index.length === 0) {
                console.log('[Viewpoints] No views found in repository.');
            }

            let loadedCount = 0;
            for (const item of index) {
                const isOwner = item.userId === this._currentUserId;
                const isShared = Array.isArray((item as any).sharedWith) && (item as any).sharedWith.includes(this._currentUserId);
                if (!isOwner && !isShared) {
                    continue;
                }
                try {
                    const fullView = await this._repository.loadViewpointData(item.file, this._currentUserId);
                    if (fullView) {
                        const existingIdx = this._savedViewpoints.findIndex(v => v.id === fullView.id);
                        if (existingIdx !== -1) {
                            this._savedViewpoints[existingIdx] = fullView;
                        } else {
                            this._savedViewpoints.push(fullView);
                        }
                        loadedCount++;
                    }
                } catch (e) {
                    console.error(`[Viewpoints] Failed to load view ${item.id}`, e);
                }
            }
            console.log(`[Viewpoints] Synced ${loadedCount} views from repository.`);
            this.renderList();
        } catch (e) {
            console.error('[Viewpoints] Error in repository sync:', e);
            alert('Error al sincronizar con el repositorio de vistas.');
        }
    }

    async exportViewpointToRepository(id: string) {
        const view = this._savedViewpoints.find(v => v.id === id);
        if (view) {
            // Show loading cursor
            const originalCursor = document.body.style.cursor;
            document.body.style.cursor = 'wait';

            try {
                // 1. Try to save to Cloud first
                console.log('[Viewpoints] Attempting cloud save...');
                const cloudSuccess = await this._repository.saveViewpointToCloud(view);
                
                if (cloudSuccess) {
                    alert(`Vista "${view.title}" guardada exitosamente en la nube.`);
                    return;
                }

                // 2. Fallback to manual download
                console.warn('[Viewpoints] Cloud save failed or not configured. Falling back to manual download.');
                this._repository.exportViewpoint(view);
                const userFolder = view.userId || 'guest';
                alert(`Vista "${view.title}" descargada (Modo Manual).\n\nNo se pudo guardar en la nube. Se ha descargado el archivo JSON.`);
            } finally {
                document.body.style.cursor = originalCursor;
            }
        }
    }

    public async saveViewpoint(title: string, category: string = 'General', description: string = '') {
        console.log('[Viewpoints] Attempting to save view:', title);

        if (!this._world.camera.controls) {
            console.error('[Viewpoints] Camera controls not found!');
            alert('Error: No se pudo acceder a la cámara para guardar la vista.');
            return;
        }

        // 1. Capture Camera
        const camera = this._world.camera.three;
        const controls = this._world.camera.controls;
        
        const position = new THREE.Vector3();
        const target = new THREE.Vector3();
        
        camera.getWorldPosition(position);
        controls.getTarget(target);

        // 2. Capture Selection
        const selection: { [fragmentID: string]: number[] } = {};
        const selectionMap = this._highlighter.selection.select;
        if (selectionMap) {
            for (const [fragID, ids] of Object.entries(selectionMap)) {
                selection[fragID] = Array.from(ids);
            }
        }

        // 3. Capture Visibility & Annotations via Provider
        let hidden: Record<string, number[]> = {};
        let annotations: any[] = [];
        let clippingPlanes: { normal: number[], constant: number }[] = [];
        let loadedModels: { uuid: string, url: string }[] = [];

        if (this._stateProvider) {
            try {
                hidden = this._stateProvider.getHiddenItems() || {};
                annotations = this._stateProvider.getMeasurements() || [];
                clippingPlanes = this._stateProvider.getClippingPlanes() || [];
                console.log(`[Viewpoints] Retrieved ${clippingPlanes.length} clipping planes from provider.`);
                loadedModels = this._stateProvider.getLoadedModels() || [];
            } catch (e) {
                console.error('[Viewpoints] Error retrieving state from provider:', e);
            }
        }

        // Validate Authentication
        if (!this._currentUserId || this._currentUserId === 'guest') {
            alert('Debe iniciar sesión para guardar vistas.');
            return;
        }

        const viewpointData: ViewpointData = {
            id: THREE.MathUtils.generateUUID(),
            userId: this._currentUserId,
            title,
            description,
            category,
            date: Date.now(),
            tags: [],
            camera: {
                position: position.toArray(),
                target: target.toArray(),
                projection: ((this._world.camera as any).projection?.current || 'Perspective').toLowerCase()
            },
            selection,
            isolation: [], 
            hidden,
            annotations,
            clippingPlanes,
            loadedModels,
            sharedWith: []
        };

        console.log('[Viewpoints] Saving viewpoint data:', JSON.stringify(viewpointData, null, 2));

        this._savedViewpoints.push(viewpointData);
        try {
            this.saveToStorage();
            console.log('[Viewpoints] Saved to storage successfully.');
            
            // Auto-save to Cloud (Drive)
            const originalCursor = document.body.style.cursor;
            document.body.style.cursor = 'wait';
            
            this._repository.saveViewpointToCloud(viewpointData).then(success => {
                document.body.style.cursor = originalCursor;
                if (success) {
                    alert(`Vista "${title}" guardada en la nube y localmente.`);
                } else {
                    alert(`Vista "${title}" guardada LOCALMENTE.\n\nNo se pudo conectar con la nube. Puedes intentar exportarla manualmente más tarde.`);
                }
            });

        } catch (e) {
            console.error('[Viewpoints] Failed to save to storage:', e);
            alert('Error al guardar en almacenamiento local (ver consola).');
        }
        
        this.renderList();
        
        return viewpointData;
    }

    // CONFIGURACIÓN DE GITHUB
    // IMPORTANTE: Reemplaza 'TU_TOKEN_AQUI' con un Personal Access Token (Classic) con permisos de 'repo'
    // Puedes crearlo aquí: https://github.com/settings/tokens
    private readonly GITHUB_TOKEN = 'TU_TOKEN_AQUI'; 
    private readonly REPO_OWNER = 'alcabama-commits';
    private readonly REPO_NAME = 'bim';
    private readonly BRANCH = 'main';

    private async _saveToServer(viewpoint: ViewpointData) {
        // Show loading feedback
        const originalText = document.body.style.cursor;
        document.body.style.cursor = 'wait';
        
        try {
            // Preparar el contenido para GitHub (debe estar en base64)
            // Usamos un pequeño hack con encodeURIComponent para soportar caracteres especiales (tildes, ñ)
            const jsonString = JSON.stringify(viewpoint, null, 2);
            const contentEncoded = btoa(unescape(encodeURIComponent(jsonString)));
            
            // Ruta donde se guardará en el repositorio
            // VSR_IFC/public/VIEWS/email/viewID.json
            const safeUserId = this._currentUserId.replace(/[^a-zA-Z0-9@._-]/g, '_');
            const filePath = `VSR_IFC/public/VIEWS/${safeUserId}/${viewpoint.id}.json`;
            
            // URL de la API de GitHub
            const url = `https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/contents/${filePath}`;

            // Verificar si el archivo ya existe para obtener su SHA (necesario para actualizar)
            let sha: string | undefined;
            try {
                const checkResponse = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${this.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                if (checkResponse.ok) {
                    const data = await checkResponse.json();
                    sha = data.sha;
                }
            } catch (checkErr) {
                // Si falla la verificación, asumimos que es nuevo (sha undefined)
                console.log('[Viewpoints] File does not exist, creating new.');
            }

            // Realizar el PUT (Crear o Actualizar)
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `feat: auto-save view ${viewpoint.title} by ${this._currentUserId}`,
                    content: contentEncoded,
                    branch: this.BRANCH,
                    sha: sha // Si existe, actualizamos. Si es undefined, creamos.
                })
            });

            document.body.style.cursor = originalText;

            if (response.ok) {
                const result = await response.json();
                console.log('[Viewpoints] Saved to GitHub successfully:', result);
                alert(`Vista "${viewpoint.title}" guardada exitosamente en GitHub.\n\nRuta: ${result.content.path}`);
            } else {
                const errorData = await response.json();
                console.error('[Viewpoints] GitHub API Error:', errorData);
                
                if (response.status === 401) {
                    alert('Error de Autenticación en GitHub: El token es inválido o expiró.\nRevisa la configuración en viewpoints-manager.ts');
                } else {
                    alert(`Error al guardar en GitHub (${response.status}):\n${errorData.message}`);
                }
            }
        } catch (e) {
            document.body.style.cursor = originalText;
            console.warn('[Viewpoints] Connection error:', e);
            alert('Error de conexión al intentar contactar con GitHub.');
        }
    }

    public async restoreViewpoint(id: string) {
        const view = this._savedViewpoints.find(v => v.id === id);
        
        // 403 Forbidden Simulation
        if (!view) {
             console.error('Viewpoint not found.');
             return;
        }
        
        if (!this.checkOwnership(view)) {
             console.error('403 Forbidden: You do not have permission to access this view.');
             alert('Error 403: No tiene permisos para acceder a esta vista.');
             return;
        }

        console.log(`Restoring viewpoint '${view.title}'...`);

        // 0. Restore Loaded Models (Critical for scene composition)
        if (this._stateProvider && view.loadedModels) {
             await this._stateProvider.restoreLoadedModels(view.loadedModels);
        }

        // 1. Restore Camera
        if (this._world.camera.controls) {
            const { position, target, projection } = view.camera;
            
            // Restore projection if needed
            const currentProjection = ((this._world.camera as any).projection?.current || 'Perspective').toLowerCase();
            if (currentProjection !== projection) {
                const projectionApi = (this._world.camera as any).projection;
                if (projectionApi && typeof projectionApi.set === 'function') {
                    if (projection === 'orthographic') {
                        await projectionApi.set('Orthographic');
                    } else {
                        await projectionApi.set('Perspective');
                    }
                }
            }

            await this._world.camera.controls.setLookAt(
                position[0], position[1], position[2],
                target[0], target[1], target[2],
                true
            );
        }

        // 2. Restore Selection
        this._highlighter.clear();
        if (view.selection && Object.keys(view.selection).length > 0) {
             const sel: { [fragID: string]: Set<number> } = {};
             for (const [fragID, ids] of Object.entries(view.selection)) {
                 sel[fragID] = new Set(ids);
             }
             this._highlighter.highlightByID('select', sel, true);
        }

        // 3. Restore Visibility & Annotations
        if (this._stateProvider) {
            if (view.hidden) {
                await this._stateProvider.restoreHiddenItems(view.hidden);
            }
            if (view.annotations) {
                this._stateProvider.restoreMeasurements(view.annotations);
            }
            if (view.clippingPlanes) {
                console.log(`[Viewpoints] Restoring ${view.clippingPlanes.length} clipping planes...`);
                this._stateProvider.restoreClippingPlanes(view.clippingPlanes);
            }
        }
        
        console.log(`Viewpoint '${view.title}' restored.`);
    }

    public async deleteViewpoint(id: string) {
        const view = this._savedViewpoints.find(v => v.id === id);
        if (!view) return;
        
        if (!this.checkOwnership(view)) {
             alert('Error 403: No tiene permisos para eliminar esta vista.');
             return;
        }

        if (!confirm(`¿Estás seguro de eliminar la vista "${view.title}"? Esta acción no se puede deshacer y se borrará también de Google Drive.`)) {
            return;
        }

        const originalCursor = document.body.style.cursor;
        document.body.style.cursor = 'wait';

        // 1. Delete from Cloud (Drive)
        try {
            const cloudSuccess = await this._repository.deleteViewpointFromCloud(id);
            if (cloudSuccess) {
                console.log(`[Viewpoints] Viewpoint ${id} deleted from cloud.`);
            } else {
                console.warn(`[Viewpoints] Failed to delete ${id} from cloud (or not configured). Deleting locally only.`);
                alert('Advertencia: El servidor no confirmó la eliminación en Drive. Verifica si la nueva versión del Script está desplegada.');
            }
        } catch (e: any) {
            console.error('[Viewpoints] Error deleting from cloud:', e);
            alert(`Error al eliminar de Drive: ${e.message || e}. \n\nAsegúrate de haber desplegado una NUEVA VERSIÓN en Google Apps Script.`);
        } finally {
            document.body.style.cursor = originalCursor;
        }

        // 2. Delete Locally
        this._savedViewpoints = this._savedViewpoints.filter(v => v.id !== id);
        this.saveToStorage();
        this.renderList();
    }

    // --- UI Logic ---

    public openSaveModal() {
        if (!this._container) return;
        const modal = this._container.querySelector('#vp-modal') as HTMLElement;
        const nameInput = this._container.querySelector('#vp-name-input') as HTMLInputElement;
        
        if (modal) {
            modal.style.display = 'block';
            if (nameInput) {
                nameInput.value = `Vista ${this._savedViewpoints.length + 1}`;
                nameInput.focus();
            }
        }
    }

    public createUI(container: HTMLElement) {
        this._container = container;
        const userName = this._currentUserId === 'guest' ? 'Invitado' : (this._currentUserId || 'Usuario');
        
        this._container.innerHTML = `
            <div class="viewpoints-ui" style="padding: 10px; color: #eee;">
                <div style="margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #444;">
                    <small style="color: #aaa; font-size: 11px;">DASHBOARD DE VISTAS</small>
                    <div style="font-weight: bold; color: var(--primary-color, #D8005E);">${userName}</div>
                </div>

                <div style="margin-bottom: 15px; display: flex; gap: 5px;">
                    <button id="vp-create-btn" class="projection-toggle-btn" style="flex: 1; justify-content: center;">
                        <i class="fa-solid fa-plus"></i> Nueva Vista
                    </button>
                    <button id="vp-import-btn" class="projection-toggle-btn" style="flex: 0 0 auto;" title="Importar vista desde archivo JSON">
                        <i class="fa-solid fa-file-import"></i>
                    </button>
                    <input type="file" id="vp-file-input" accept=".json" style="display: none;" />
                    <button id="vp-refresh-btn" class="projection-toggle-btn" style="flex: 0 0 auto;" title="Recargar vistas del repositorio">
                        <i class="fa-solid fa-sync"></i>
                    </button>
                    <button id="vp-save-btn" class="projection-toggle-btn" style="flex: 0 0 auto;" title="Guardar cambios en vista actual">
                        <i class="fa-solid fa-save"></i>
                    </button>
                </div>
                
                <div style="margin-bottom: 10px;">
                    <input type="text" id="vp-search" placeholder="Buscar vistas..." style="width: 100%; padding: 5px; background: #333; border: 1px solid #555; color: white; border-radius: 4px;">
                </div>

                <div id="vp-list" style="max-height: 400px; overflow-y: auto;">
                    <!-- List items will be injected here -->
                </div>
            </div>
            
            <!-- Create/Edit Modal (Hidden by default) -->
            <div id="vp-modal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #222; padding: 20px; border: 1px solid #444; z-index: 2000; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border-radius: 8px; width: 300px;">
                <h3 style="margin-top: 0;">Guardar Vista</h3>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Nombre:</label>
                    <input type="text" id="vp-name-input" style="width: 100%; padding: 5px; background: #333; border: 1px solid #555; color: white;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Categoría:</label>
                    <select id="vp-category-input" style="width: 100%; padding: 5px; background: #333; border: 1px solid #555; color: white;">
                        <option value="General">General</option>
                        <option value="Arquitectura">Arquitectura</option>
                        <option value="Estructura">Estructura</option>
                        <option value="Instalaciones">Instalaciones</option>
                        <option value="Detalles">Detalles</option>
                    </select>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
                    <button id="vp-cancel-btn" style="padding: 5px 10px; background: #555; border: none; color: white; cursor: pointer; border-radius: 4px;">Cancelar</button>
                    <button id="vp-confirm-btn" style="padding: 5px 10px; background: #4caf50; border: none; color: white; cursor: pointer; border-radius: 4px;">Guardar</button>
                </div>
            </div>
        `;
        
        this._listContainer = this._container.querySelector('#vp-list');
        
        // Event Listeners
        const createBtn = this._container.querySelector('#vp-create-btn');
        const importBtn = this._container.querySelector('#vp-import-btn');
        const refreshBtn = this._container.querySelector('#vp-refresh-btn');
        const fileInput = this._container.querySelector('#vp-file-input') as HTMLInputElement;
        const modal = this._container.querySelector('#vp-modal') as HTMLElement;
        const cancelBtn = this._container.querySelector('#vp-cancel-btn');
        const confirmBtn = this._container.querySelector('#vp-confirm-btn');
        const nameInput = this._container.querySelector('#vp-name-input') as HTMLInputElement;
        const categoryInput = this._container.querySelector('#vp-category-input') as HTMLSelectElement;
        const searchInput = this._container.querySelector('#vp-search') as HTMLInputElement;

        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (modal) {
                    modal.style.display = 'block';
                    nameInput.value = `Vista ${this._savedViewpoints.length + 1}`;
                    nameInput.focus();
                }
            });
        }

        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                    await this.importViewpointFromFile(file);
                    fileInput.value = ''; // Reset
                }
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const icon = refreshBtn.querySelector('i');
                if (icon) icon.classList.add('fa-spin');
                await this.loadFromRepository();
                if (icon) icon.classList.remove('fa-spin');
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (modal) modal.style.display = 'none';
            });
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const name = nameInput.value || 'Sin título';
                const category = categoryInput.value || 'General';
                await this.saveViewpoint(name, category);
                if (modal) modal.style.display = 'none';
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = (e.target as HTMLInputElement).value.toLowerCase();
                this.renderList(term);
            });
        }

        this.renderList();
    }

    private renderList(filterTerm: string = '') {
        if (!this._listContainer) return;
        this._listContainer.innerHTML = '';
        
        let filtered = this._savedViewpoints;
        if (filterTerm) {
            filtered = filtered.filter(v => v.title.toLowerCase().includes(filterTerm) || v.category.toLowerCase().includes(filterTerm));
        }

        const ownedViews = filtered.filter(v => this.isCurrentUser(v.userId));
        const sharedViews = filtered.filter(v => !this.isCurrentUser(v.userId));

        const categories: {[key: string]: ViewpointData[]} = {};
        ownedViews.forEach(v => {
            const cat = v.category || 'General';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(v);
        });

        if (Object.keys(categories).length === 0 && sharedViews.length === 0) {
            this._listContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No hay vistas guardadas</div>';
            return;
        }

        const renderGroup = (cat: string, views: ViewpointData[], sectionName?: string) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'viewpoint-group';
            groupDiv.style.marginBottom = '10px';
            
            // Header
            groupDiv.innerHTML = `
                <div style="background: #444; padding: 5px 10px; font-weight: bold; font-size: 12px; border-radius: 4px 4px 0 0; display: flex; align-items: center; justify-content: space-between;">
                    <span>${sectionName ? `${sectionName} / ${cat}` : cat}</span>
                    <span style="font-size: 10px; background: #666; padding: 2px 6px; border-radius: 10px;">${views.length}</span>
                </div>
            `;
            
            const listDiv = document.createElement('div');
            listDiv.style.background = 'rgba(0,0,0,0.2)';
            listDiv.style.border = '1px solid #444';
            listDiv.style.borderTop = 'none';
            listDiv.style.borderRadius = '0 0 4px 4px';
            
            views.forEach(v => {
                const item = document.createElement('div');
                item.className = 'viewpoint-item';
                item.style.padding = '8px 10px';
                item.style.borderBottom = '1px solid #444';
                item.style.cursor = 'pointer';
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.fontSize = '13px';
                
                // Format date
                const date = new Date(v.date).toLocaleDateString();
                const isOwned = this.isCurrentUser(v.userId);
                const metaLine = isOwned
                    ? date
                    : `${date} • Compartida por ${v.userId}`;
                
                item.innerHTML = `
                    <div style="display: flex; flex-direction: column; overflow: hidden; width: 60%;">
                        <span style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${v.title}</span>
                        <span style="font-size: 10px; color: #aaa;">${metaLine}</span>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        ${isOwned ? `<button class="share-view-btn" title="Compartir" style="background:none; border:none; color: #ff9800; cursor: pointer;"><i class="fa-solid fa-share-nodes"></i></button>` : ``}
                        <button class="restore-view-btn" title="Restaurar" style="background:none; border:none; color: #4caf50; cursor: pointer;"><i class="fa-solid fa-eye"></i></button>
                        ${isOwned ? `<button class="export-view-btn" title="Exportar a Repositorio" style="background:none; border:none; color: #2196f3; cursor: pointer;"><i class="fa-solid fa-file-export"></i></button>` : ``}
                        ${isOwned ? `<button class="delete-view-btn" title="Eliminar" style="background:none; border:none; color: #e91e63; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>` : ``}
                    </div>
                `;
                
                // Hover effect
                item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.05)';
                item.onmouseleave = () => item.style.background = 'transparent';
                
                // Click to restore
                item.onclick = (e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    this.restoreViewpoint(v.id);
                };
                
                const restoreBtn = item.querySelector('.restore-view-btn');
                if (restoreBtn) {
                    restoreBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.restoreViewpoint(v.id);
                    });
                }

                const shareBtn = item.querySelector('.share-view-btn');
                if (shareBtn) {
                    shareBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await this.shareViewpoint(v.id);
                    });
                }

                const exportBtn = item.querySelector('.export-view-btn');
                if (exportBtn) {
                    exportBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.exportViewpointToRepository(v.id);
                    });
                }

                const delBtn = item.querySelector('.delete-view-btn');
                if (delBtn) {
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Confirm moved to deleteViewpoint
                        this.deleteViewpoint(v.id);
                    });
                }

                listDiv.appendChild(item);
            });
            
            groupDiv.appendChild(listDiv);
            this._listContainer.appendChild(groupDiv);
        };

        for (const [cat, views] of Object.entries(categories)) {
            renderGroup(cat, views);
        }

        if (sharedViews.length > 0) {
            const sharedByCategory: {[key: string]: ViewpointData[]} = {};
            sharedViews.forEach(v => {
                const cat = v.category || 'General';
                if (!sharedByCategory[cat]) sharedByCategory[cat] = [];
                sharedByCategory[cat].push(v);
            });
            for (const [cat, views] of Object.entries(sharedByCategory)) {
                renderGroup(cat, views, 'Compartidas');
            }
        }
    }

    private getStorageKey(): string {
        if (!this._currentUserId || this._currentUserId === 'guest') {
            return 'vsr-ifc-viewpoints-guest';
        }
        // User-Specific Storage Key (Simulates Database Partitioning)
        return `vsr-ifc-viewpoints-${this._currentUserId}`;
    }

    private saveToStorage() {
        const key = this.getStorageKey();
        localStorage.setItem(key, JSON.stringify(this._savedViewpoints));
    }

    private loadFromStorage() {
        const key = this.getStorageKey();
        const data = localStorage.getItem(key);
        if (data) {
            try {
                this._savedViewpoints = JSON.parse(data);
                
                // Verify ownership integrity on load (Middleware check)
                this._savedViewpoints = this._savedViewpoints.filter(v => {
                    if (!this._currentUserId || this._currentUserId === 'guest') return false;
                    if (v.userId === this._currentUserId) return true;
                    if (Array.isArray(v.sharedWith) && v.sharedWith.includes(this._currentUserId)) return true;
                    console.warn(`[Security] Filtered out unauthorized view ${v.id} belonging to ${v.userId}`);
                    return false;
                });

            } catch (e) {
                console.error("Failed to load viewpoints", e);
            }
        } else {
            this._savedViewpoints = [];
        }
    }

    private async shareViewpoint(id: string) {
        if (!this._currentUserId || this._currentUserId === 'guest') {
            alert('Debe iniciar sesión para compartir vistas.');
            return;
        }

        const view = this._savedViewpoints.find(v => v.id === id);
        if (!view) return;
        if (view.userId !== this._currentUserId) {
            alert('Solo puedes compartir vistas que hayas creado.');
            return;
        }

        let users: ActiveUser[] = [];
        let usersLoadError = '';
        try {
            users = await this._repository.loadActiveUsers();
        } catch (e) {
            console.warn('[Viewpoints] No se pudo cargar la lista de usuarios activos:', e);
            usersLoadError = e instanceof Error ? e.message : 'No se pudo cargar la lista de usuarios activos.';
        }

        const currentList = Array.isArray(view.sharedWith) ? view.sharedWith : [];
        const mergedUsers = [...users, ...this.collectKnownUsers(), ...currentList.map(id => ({ id, name: id, email: id.includes('@') ? id : undefined }))];
        const userMap = new Map<string, ActiveUser>();
        for (const user of mergedUsers) {
            if (!user?.id) continue;
            const key = String(user.id).trim().toLowerCase();
            if (!key || this.isCurrentUser(key)) continue;
            if (!userMap.has(key)) userMap.set(key, { ...user, id: String(user.id).trim() });
        }
        const selectableUsers = Array.from(userMap.values()).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, 'es'));
        const selection = await this.openShareUsersModal(view.title, selectableUsers, currentList, usersLoadError);
        if (selection === null) return;
        view.sharedWith = selection;

        const originalCursor = document.body.style.cursor;
        document.body.style.cursor = 'wait';
        try {
            const ok = await this._repository.shareViewpointToCloud(view.id, this._currentUserId, view.sharedWith || []);
            if (!ok) {
                alert('No se pudo compartir la vista en la nube. Ver consola.');
                return;
            }

            this.saveToStorage();
            this.renderList();
            if (!view.sharedWith || view.sharedWith.length === 0) {
                alert('Acceso compartido eliminado.');
            } else {
                alert(`Vista compartida con ${view.sharedWith.length} usuario(s).`);
            }
        } finally {
            document.body.style.cursor = originalCursor;
        }
    }

    private openShareUsersModal(title: string, users: ActiveUser[], preselected: string[], loadError: string = ''): Promise<string[] | null> {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.background = 'rgba(0,0,0,0.6)';
            overlay.style.zIndex = '3000';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';

            const panel = document.createElement('div');
            panel.style.width = '420px';
            panel.style.maxWidth = '90vw';
            panel.style.background = '#222';
            panel.style.border = '1px solid #444';
            panel.style.borderRadius = '10px';
            panel.style.boxShadow = '0 4px 18px rgba(0,0,0,0.5)';
            panel.style.padding = '14px';
            panel.style.color = '#eee';

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.flexDirection = 'column';
            header.style.gap = '6px';

            const h = document.createElement('div');
            h.style.fontWeight = '700';
            h.textContent = `Compartir: ${title}`;

            const sub = document.createElement('div');
            sub.style.fontSize = '12px';
            sub.style.color = '#aaa';
            sub.textContent = 'Selecciona usuarios dentro de la plataforma (no se envía correo).';

            const warning = document.createElement('div');
            warning.style.fontSize = '11px';
            warning.style.color = '#fca5a5';
            warning.style.display = loadError ? 'block' : 'none';
            warning.textContent = loadError ? `No se pudo cargar la hoja de usuarios: ${loadError}` : '';

            const search = document.createElement('input');
            search.type = 'text';
            search.placeholder = 'Buscar usuario...';
            search.style.width = '100%';
            search.style.padding = '8px';
            search.style.background = '#333';
            search.style.border = '1px solid #555';
            search.style.color = '#fff';
            search.style.borderRadius = '6px';

            header.appendChild(h);
            header.appendChild(sub);
            header.appendChild(warning);
            header.appendChild(search);

            const list = document.createElement('div');
            list.style.marginTop = '10px';
            list.style.maxHeight = '320px';
            list.style.overflow = 'auto';
            list.style.border = '1px solid #333';
            list.style.borderRadius = '8px';
            list.style.background = 'rgba(0,0,0,0.2)';

            const selected = new Set((preselected || []).map(v => String(v).trim()).filter(Boolean));
            const render = (term: string) => {
                const q = term.trim().toLowerCase();
                list.innerHTML = '';

                const filtered = users
                    .filter(u => u?.id)
                    .filter(u => {
                        if (!q) return true;
                        const name = (u.name || '').toLowerCase();
                        const id = (u.id || '').toLowerCase();
                        const email = (u.email || '').toLowerCase();
                        return name.includes(q) || id.includes(q) || email.includes(q);
                    })
                    .slice(0, 200);

                if (filtered.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.padding = '10px';
                    empty.style.color = '#888';
                    empty.textContent = loadError
                        ? 'No se pudieron cargar usuarios desde la plataforma.'
                        : 'No hay usuarios para mostrar.';
                    list.appendChild(empty);
                    return;
                }

                for (const u of filtered) {
                    const row = document.createElement('label');
                    row.style.display = 'flex';
                    row.style.gap = '10px';
                    row.style.alignItems = 'center';
                    row.style.padding = '8px 10px';
                    row.style.borderBottom = '1px solid #333';
                    row.style.cursor = 'pointer';

                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = selected.has(u.id);
                    cb.onchange = () => {
                        if (cb.checked) selected.add(u.id);
                        else selected.delete(u.id);
                    };

                    const text = document.createElement('div');
                    text.style.display = 'flex';
                    text.style.flexDirection = 'column';
                    text.style.overflow = 'hidden';

                    const primary = document.createElement('div');
                    primary.style.whiteSpace = 'nowrap';
                    primary.style.overflow = 'hidden';
                    primary.style.textOverflow = 'ellipsis';
                    primary.textContent = u.name || u.id;

                    const secondary = document.createElement('div');
                    secondary.style.fontSize = '11px';
                    secondary.style.color = '#aaa';
                    secondary.textContent = u.email && u.email !== u.id ? `${u.id} • ${u.email}` : u.id;

                    text.appendChild(primary);
                    text.appendChild(secondary);

                    row.appendChild(cb);
                    row.appendChild(text);
                    list.appendChild(row);
                }
            };

            render('');
            search.addEventListener('input', () => render(search.value));

            const footer = document.createElement('div');
            footer.style.display = 'flex';
            footer.style.justifyContent = 'space-between';
            footer.style.alignItems = 'center';
            footer.style.marginTop = '12px';

            const left = document.createElement('div');
            left.style.fontSize = '12px';
            left.style.color = '#aaa';
            left.textContent = `Seleccionados: ${selected.size}`;

            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.gap = '8px';

            const cancel = document.createElement('button');
            cancel.textContent = 'Cancelar';
            cancel.style.padding = '8px 12px';
            cancel.style.background = '#333';
            cancel.style.border = '1px solid #555';
            cancel.style.color = '#fff';
            cancel.style.borderRadius = '8px';
            cancel.style.cursor = 'pointer';

            const save = document.createElement('button');
            save.textContent = 'Guardar';
            save.style.padding = '8px 12px';
            save.style.background = 'var(--primary-color, #D8005E)';
            save.style.border = '1px solid rgba(0,0,0,0.2)';
            save.style.color = '#fff';
            save.style.borderRadius = '8px';
            save.style.cursor = 'pointer';

            const cleanup = (result: string[] | null) => {
                document.body.removeChild(overlay);
                resolve(result);
            };

            const updateCount = () => {
                left.textContent = `Seleccionados: ${selected.size}`;
            };

            list.addEventListener('change', updateCount);

            cancel.onclick = () => cleanup(null);
            save.onclick = () => cleanup(Array.from(selected));

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(null);
            });

            right.appendChild(cancel);
            right.appendChild(save);
            footer.appendChild(left);
            footer.appendChild(right);

            panel.appendChild(header);
            panel.appendChild(list);
            panel.appendChild(footer);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            search.focus();
        });
    }

    async dispose() {
        // this._viewpoints.dispose(); // If needed
    }

    get() {
        return this;
    }
}
