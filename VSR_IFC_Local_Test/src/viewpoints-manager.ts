import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';

export interface ViewpointData {
    id: string;
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
}

export interface ViewpointStateProvider {
    getMeasurements(): any[];
    restoreMeasurements(data: any[]): void;
    getHiddenItems(): Record<string, number[]>;
    restoreHiddenItems(items: Record<string, number[]>): void;
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
        
        this.loadFromStorage();
    }

    setStateProvider(provider: ViewpointStateProvider) {
        this._stateProvider = provider;
    }

    public async saveViewpoint(title: string, category: string = 'General', description: string = '') {
        if (!this._world.camera.controls) return;

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
        for (const [fragID, ids] of Object.entries(selectionMap)) {
            selection[fragID] = Array.from(ids);
        }

        // 3. Capture Visibility & Annotations via Provider
        let hidden: Record<string, number[]> = {};
        let annotations: any[] = [];

        if (this._stateProvider) {
            hidden = this._stateProvider.getHiddenItems();
            annotations = this._stateProvider.getMeasurements();
        }

        const viewpointData: ViewpointData = {
            id: THREE.MathUtils.generateUUID(),
            title,
            description,
            category,
            date: Date.now(),
            tags: [],
            camera: {
                position: position.toArray(),
                target: target.toArray(),
                projection: this._world.camera.projection.toLowerCase()
            },
            selection,
            isolation: [], 
            hidden,
            annotations
        };

        this._savedViewpoints.push(viewpointData);
        this.saveToStorage();
        this.renderList();
        
        console.log(`Viewpoint '${title}' saved.`, viewpointData);
        return viewpointData;
    }

    public async restoreViewpoint(id: string) {
        const view = this._savedViewpoints.find(v => v.id === id);
        if (!view) return;

        console.log(`Restoring viewpoint '${view.title}'...`);

        // 1. Restore Camera
        if (this._world.camera.controls) {
            const { position, target, projection } = view.camera;
            
            // Restore projection if needed
            if (this._world.camera.projection.toLowerCase() !== projection) {
                if (projection === 'orthographic') {
                    await this._world.camera.set('Orthographic');
                } else {
                    await this._world.camera.set('Perspective');
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
        }
        
        console.log(`Viewpoint '${view.title}' restored.`);
    }

    public deleteViewpoint(id: string) {
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
        this._container.innerHTML = `
            <div class="viewpoints-ui" style="padding: 10px; color: #eee;">
                <div style="margin-bottom: 15px; display: flex; gap: 5px;">
                    <button id="vp-create-btn" class="projection-toggle-btn" style="flex: 1; justify-content: center;">
                        <i class="fa-solid fa-plus"></i> Nueva Vista
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

        // Group by category
        const categories: {[key: string]: ViewpointData[]} = {};
        filtered.forEach(v => {
            const cat = v.category || 'General';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(v);
        });

        if (Object.keys(categories).length === 0) {
            this._listContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No hay vistas guardadas</div>';
            return;
        }

        // Render groups
        for (const [cat, views] of Object.entries(categories)) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'viewpoint-group';
            groupDiv.style.marginBottom = '10px';
            
            // Header
            groupDiv.innerHTML = `
                <div style="background: #444; padding: 5px 10px; font-weight: bold; font-size: 12px; border-radius: 4px 4px 0 0; display: flex; align-items: center; justify-content: space-between;">
                    <span>${cat}</span>
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
                
                item.innerHTML = `
                    <div style="display: flex; flex-direction: column; overflow: hidden;">
                        <span style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${v.title}</span>
                        <span style="font-size: 10px; color: #aaa;">${date}</span>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="restore-view-btn" title="Restaurar" style="background:none; border:none; color: #4caf50; cursor: pointer;"><i class="fa-solid fa-eye"></i></button>
                        <button class="delete-view-btn" title="Eliminar" style="background:none; border:none; color: #e91e63; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
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

                const delBtn = item.querySelector('.delete-view-btn');
                if (delBtn) {
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`¿Estás seguro de eliminar la vista "${v.title}"?`)) {
                            this.deleteViewpoint(v.id);
                        }
                    });
                }

                listDiv.appendChild(item);
            });
            
            groupDiv.appendChild(listDiv);
            this._listContainer.appendChild(groupDiv);
        }
    }

    private saveToStorage() {
        localStorage.setItem('vsr-ifc-viewpoints', JSON.stringify(this._savedViewpoints));
    }

    private loadFromStorage() {
        const data = localStorage.getItem('vsr-ifc-viewpoints');
        if (data) {
            try {
                this._savedViewpoints = JSON.parse(data);
            } catch (e) {
                console.error("Failed to load viewpoints", e);
            }
        }
    }

    async dispose() {
        // this._viewpoints.dispose(); // If needed
    }

    get() {
        return this;
    }
}
