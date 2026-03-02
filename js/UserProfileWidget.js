
export class UserProfileWidget {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.userProfile = null;
        this.init();
    }

    init() {
        this.loadUserProfile();
        this.renderTrigger();
        this.renderModal();
        this.setupEventListeners();
        this.updateConnectionStatus();
        
        window.addEventListener('online', () => this.updateConnectionStatus());
        window.addEventListener('offline', () => this.updateConnectionStatus());
        
        this.logAudit('User Profile Widget Initialized');
    }

    loadUserProfile() {
        const stored = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount');
        if (stored) {
            try {
                this.userProfile = JSON.parse(stored);
                this.logAudit('User profile loaded successfully');
            } catch (e) {
                console.error('Error parsing profile', e);
                this.logAudit('Error parsing user profile', 'ERROR');
            }
        } else {
            this.logAudit('No user profile found - Guest mode');
        }
    }

    logAudit(action, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const user = this.userProfile ? (this.userProfile.username || this.userProfile.name) : 'Guest';
        console.log(`[AUDIT] [${timestamp}] [${level}] [${user}] ${action}`);
    }

    renderTrigger() {
        if (!this.container) return;
        
        const name = this.userProfile ? this.userProfile.name.split(' ')[0] : 'Invitado';
        const photo = this.userProfile?.photo;
        const initials = this.getInitials(this.userProfile?.name || 'Invitado');

        this.container.innerHTML = `
            <div id="user-profile-trigger" class="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div class="relative">
                    ${photo 
                        ? `<img src="${photo}" class="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-800 shadow-sm" alt="Profile">`
                        : `<div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-sm" style="background-color: #D8005E;">${initials}</div>`
                    }
                    <div id="widget-connection-status" class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 bg-green-500" title="Conectado"></div>
                </div>
                <div class="hidden md:block text-left">
                    <p class="text-sm font-semibold text-gray-800 dark:text-white leading-tight">${name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Ver perfil</p>
                </div>
            </div>
        `;
    }

    renderModal() {
        // Remove existing modal if any
        const existing = document.getElementById('user-profile-modal');
        if (existing) existing.remove();

        const name = this.userProfile?.name || 'Invitado';
        const email = this.userProfile?.username || '';
        const role = this.userProfile?.role || 'Usuario';
        const photo = this.userProfile?.photo;
        const initials = this.getInitials(name);
        const lastAccess = this.userProfile?.lastAccess ? new Date(this.userProfile.lastAccess).toLocaleString() : 'N/A';

        const modalHtml = `
            <div id="user-profile-modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm transition-opacity">
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden transform transition-all scale-100">
                    <!-- Header -->
                    <div class="relative h-32 bg-gradient-to-r from-pink-600 to-purple-600">
                        <button class="close-modal absolute top-4 right-4 text-white hover:text-gray-200 focus:outline-none">
                            <span class="material-symbols-outlined text-2xl">close</span>
                        </button>
                    </div>
                    
                    <!-- Body -->
                    <div class="px-6 pb-6 relative">
                        <!-- Avatar -->
                        <div class="absolute -top-16 left-1/2 transform -translate-x-1/2 group">
                            <div class="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 overflow-hidden bg-white shadow-lg relative">
                                ${photo 
                                    ? `<img id="modal-avatar-img" src="${photo}" class="w-full h-full object-cover">`
                                    : `<div id="modal-avatar-initials" class="w-full h-full bg-primary text-white flex items-center justify-center text-4xl font-bold" style="background-color: #D8005E;">${initials}</div>`
                                }
                                <div class="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" id="trigger-photo-upload">
                                    <span class="material-symbols-outlined text-white text-3xl">photo_camera</span>
                                </div>
                            </div>
                            <input type="file" id="photo-upload-input" accept="image/png, image/jpeg" class="hidden">
                        </div>

                        <!-- Info -->
                        <div class="mt-20 text-center">
                            <h2 class="text-2xl font-bold text-gray-800 dark:text-white">${name}</h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">${email}</p>
                            
                            <div class="flex justify-center gap-2 mb-6">
                                <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium dark:bg-blue-900 dark:text-blue-200">${role}</span>
                                <span class="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium dark:bg-gray-700 dark:text-gray-300">
                                    <span class="w-2 h-2 inline-block rounded-full bg-green-500 mr-1"></span> Online
                                </span>
                            </div>

                            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 text-left">
                                <p class="text-xs text-gray-400 uppercase font-semibold mb-2">Detalles de la cuenta</p>
                                <div class="flex items-center justify-between py-2">
                                    <span class="text-sm text-gray-600 dark:text-gray-300">Último acceso</span>
                                    <span class="text-sm font-medium text-gray-800 dark:text-white">${lastAccess}</span>
                                </div>
                            </div>

                            <div class="mt-6 flex gap-3">
                                <button id="widget-logout-btn" class="flex-1 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium dark:bg-red-900/20 dark:text-red-400">
                                    Cerrar Sesión
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    setupEventListeners() {
        const trigger = document.getElementById('user-profile-trigger');
        const modal = document.getElementById('user-profile-modal');
        const closeBtns = document.querySelectorAll('.close-modal');
        const logoutBtn = document.getElementById('widget-logout-btn');
        const uploadTrigger = document.getElementById('trigger-photo-upload');
        const fileInput = document.getElementById('photo-upload-input');

        if (trigger && modal) {
            trigger.addEventListener('click', () => {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            });
        }

        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            });
        });

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logAudit('User logged out');
                sessionStorage.removeItem('userAccount');
                localStorage.removeItem('userAccount');
                window.location.reload();
            });
        }

        if (uploadTrigger && fileInput) {
            uploadTrigger.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handlePhotoUpload(e));
        }
    }

    getInitials(name) {
        const parts = name.split(' ');
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    updateConnectionStatus() {
        const isOnline = navigator.onLine;
        const statusEl = document.getElementById('widget-connection-status');
        if (statusEl) {
            statusEl.className = `absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`;
            statusEl.title = isOnline ? 'Conectado' : 'Sin conexión';
        }
    }

    handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.match('image.*')) {
            alert('Solo imágenes JPG/PNG');
            this.logAudit('Invalid file type uploaded', 'WARN');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('Máximo 2MB');
            this.logAudit('File too large', 'WARN');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (this.userProfile) {
                this.userProfile.photo = e.target.result;
                
                // Save to storage
                if (localStorage.getItem('userAccount')) {
                    localStorage.setItem('userAccount', JSON.stringify(this.userProfile));
                } else {
                    sessionStorage.setItem('userAccount', JSON.stringify(this.userProfile));
                }
                
                this.renderTrigger();
                this.renderModal();
                this.setupEventListeners();
                this.logAudit('User updated profile photo');
                
                // Note: Sync with Azure requires backend proxy
                console.warn('Photo updated locally. Sync with Azure requires backend proxy.');
                
                // Ensure modal is open
                const modal = document.getElementById('user-profile-modal');
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                }
            }
        };
        reader.readAsDataURL(file);
    }
}
