
export class UserProfileManager {
    private trigger: HTMLElement | null;
    private modal: HTMLElement | null;
    private closeBtn: HTMLElement | null;
    private logoutBtn: HTMLElement | null;
    private uploadInput: HTMLInputElement | null;
    private uploadBtn: HTMLElement | null;

    private nameDisplay: HTMLElement | null;
    private avatarDisplay: HTMLElement | null;
    private statusIndicator: HTMLElement | null;

    private modalName: HTMLElement | null;
    private modalEmail: HTMLElement | null;
    private modalRole: HTMLElement | null;
    private modalAvatar: HTMLElement | null;
    private modalLastAccess: HTMLElement | null;

    private userProfile: any = null;

    constructor() {
        this.trigger = document.getElementById('user-profile-trigger');
        this.modal = document.getElementById('user-profile-modal');
        this.closeBtn = document.querySelector('.close-modal');
        this.logoutBtn = document.getElementById('logout-btn');
        
        // New UI elements for upload
        this.uploadInput = document.getElementById('profile-photo-input') as HTMLInputElement;
        this.uploadBtn = document.getElementById('update-photo-btn');

        // Header elements
        this.nameDisplay = document.getElementById('user-name-display');
        this.avatarDisplay = document.getElementById('user-avatar');
        this.statusIndicator = document.getElementById('connection-status');

        // Modal elements
        this.modalName = document.getElementById('modal-user-name');
        this.modalEmail = document.getElementById('modal-user-email');
        this.modalRole = document.getElementById('modal-user-role');
        this.modalAvatar = document.getElementById('modal-user-avatar');
        this.modalLastAccess = document.getElementById('modal-last-access');

        this.init();
    }

    private init() {
        this.loadUserProfile();
        this.setupEventListeners();
        this.updateConnectionStatus();
        this.logAudit('User Profile Manager Initialized');
        
        // Monitor connection status
        window.addEventListener('online', () => this.updateConnectionStatus());
        window.addEventListener('offline', () => this.updateConnectionStatus());
    }

    private loadUserProfile() {
        const storedUser = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount');
        
        if (storedUser) {
            try {
                this.userProfile = JSON.parse(storedUser);
                this.updateUI();
                this.logAudit('User profile loaded successfully');
            } catch (e) {
                console.error('Error parsing user profile:', e);
                this.logAudit('Error parsing user profile', 'ERROR');
            }
        } else {
            if (this.nameDisplay) this.nameDisplay.textContent = 'Invitado';
            this.logAudit('No user profile found - Guest mode');
        }
    }

    private updateUI() {
        if (!this.userProfile) return;

        const name = this.userProfile.name || 'Usuario';
        const email = this.userProfile.username || '';
        const role = this.userProfile.role || '';
        const photo = this.userProfile.photo; // Base64 string
        const lastAccess = this.userProfile.lastAccess ? new Date(this.userProfile.lastAccess).toLocaleString() : 'N/A';

        // Get initials
        const names = name.split(' ');
        let initials = names[0][0];
        if (names.length > 1) initials += names[names.length - 1][0];
        initials = initials.toUpperCase();

        // Update Header Display
        if (this.nameDisplay) {
            this.nameDisplay.textContent = name.split(' ')[0]; 
            this.nameDisplay.style.display = 'block';
        }
        
        this.updateAvatar(this.avatarDisplay, photo, initials, '40px');

        // Update Modal
        if (this.modalName) this.modalName.textContent = name;
        if (this.modalEmail) this.modalEmail.textContent = email;
        if (this.modalRole) {
            this.modalRole.textContent = role;
            this.modalRole.style.display = 'inline-block';
        }
        if (this.modalLastAccess) {
            this.modalLastAccess.textContent = `Último acceso: ${lastAccess}`;
            this.modalLastAccess.style.display = 'block';
        }

        this.updateAvatar(this.modalAvatar, photo, initials, '80px', true);
    }

    private updateAvatar(element: HTMLElement | null, photo: string | null, initials: string, size: string, isModal = false) {
        if (!element) return;
        
        if (photo) {
            element.innerHTML = `<img src="${photo}" alt="User Photo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            element.style.backgroundColor = 'transparent';
        } else {
            element.textContent = initials;
            element.innerHTML = initials;
            element.style.backgroundColor = '#D8005E';
            if (isModal) {
                 element.style.fontSize = '32px';
            }
        }
    }

    private setupEventListeners() {
        if (this.trigger && this.modal) {
            this.trigger.addEventListener('click', () => {
                this.modal!.style.display = 'flex';
                this.logAudit('User opened profile modal');
            });
        }

        if (this.closeBtn && this.modal) {
            this.closeBtn.addEventListener('click', () => {
                this.modal!.style.display = 'none';
            });
        }

        if (this.modal) {
            window.addEventListener('click', (event) => {
                if (event.target === this.modal) {
                    this.modal!.style.display = 'none';
                }
            });
        }

        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }

        if (this.uploadBtn && this.uploadInput) {
            this.uploadBtn.addEventListener('click', () => {
                this.uploadInput!.click();
            });

            this.uploadInput.addEventListener('change', (e) => {
                this.handlePhotoUpload(e);
            });
        }
    }

    private handlePhotoUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            
            // Validate file type and size
            if (!file.type.match('image.*')) {
                alert('Por favor selecciona una imagen (JPG, PNG).');
                return;
            }
            if (file.size > 2 * 1024 * 1024) { // 2MB
                alert('La imagen no debe superar los 2MB.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                this.saveNewPhoto(result);
            };
            reader.readAsDataURL(file);
        }
    }

    private saveNewPhoto(base64Photo: string) {
        if (this.userProfile) {
            this.userProfile.photo = base64Photo;
            
            // Update storage
            if (localStorage.getItem('userAccount')) {
                localStorage.setItem('userAccount', JSON.stringify(this.userProfile));
            } else {
                sessionStorage.setItem('userAccount', JSON.stringify(this.userProfile));
            }
            
            // Update UI
            this.updateUI();
            this.logAudit('User updated profile photo');
            
            // Optional: Try to sync with backend/Azure if possible (not implemented here as we lack backend proxy)
            console.log('Photo updated locally. Sync with Azure requires backend proxy with User.ReadWrite.All scope.');
        }
    }

    private handleLogout() {
        this.logAudit('User logged out');
        sessionStorage.removeItem('userAccount');
        localStorage.removeItem('userAccount');
        
        // Redirect logic
        if (window.location.pathname.includes('/docs/VSR_IFC/')) {
            window.location.href = '../../inse.html';
        } else if (window.location.pathname.includes('/VSR_IFC/')) {
             window.location.href = '../inse.html';
        } else {
             window.location.href = '../inse.html';
        }
    }

    private updateConnectionStatus() {
        const isOnline = navigator.onLine;
        if (this.statusIndicator) {
            this.statusIndicator.style.backgroundColor = isOnline ? '#4CAF50' : '#f44336';
            this.statusIndicator.title = isOnline ? 'Conectado' : 'Sin conexión';
        }
    }

    private logAudit(action: string, level: 'INFO' | 'ERROR' | 'WARN' = 'INFO') {
        const timestamp = new Date().toISOString();
        const user = this.userProfile ? this.userProfile.username : 'Guest';
        console.log(`[AUDIT] [${timestamp}] [${level}] [${user}] ${action}`);
        // Here we could push to a local log array or send to an endpoint
    }
}
