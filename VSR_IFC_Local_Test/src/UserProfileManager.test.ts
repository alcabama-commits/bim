
/// <reference types="vitest" />
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserProfileManager } from './UserProfileManager';

// Mock DOM elements
document.body.innerHTML = `
    <div id="user-profile-trigger"></div>
    <div id="user-profile-modal" style="display: none;"></div>
    <div class="close-modal"></div>
    <div id="logout-btn"></div>
    <input id="profile-photo-input" type="file" />
    <div id="update-photo-btn"></div>
    <div id="user-name-display"></div>
    <div id="user-avatar"></div>
    <div id="connection-status"></div>
    <div id="modal-user-name"></div>
    <div id="modal-user-email"></div>
    <div id="modal-user-role"></div>
    <div id="modal-user-avatar"></div>
    <div id="modal-last-access"></div>
`;

describe('UserProfileManager', () => {
    let manager: UserProfileManager;

    beforeEach(() => {
        // Clear storage
        sessionStorage.clear();
        localStorage.clear();
        vi.clearAllMocks();
        
        // Reset DOM state
        document.getElementById('user-name-display')!.textContent = '';
        document.getElementById('connection-status')!.style.backgroundColor = '';
    });

    it('should initialize with Guest mode if no profile found', () => {
        manager = new UserProfileManager();
        const nameDisplay = document.getElementById('user-name-display');
        expect(nameDisplay?.textContent).toBe('Invitado');
    });

    it('should load user profile from sessionStorage', () => {
        const mockProfile = {
            name: 'Test User',
            username: 'test@example.com',
            role: 'Admin',
            photo: null,
            lastAccess: new Date().toISOString()
        };
        sessionStorage.setItem('userAccount', JSON.stringify(mockProfile));

        manager = new UserProfileManager();

        const nameDisplay = document.getElementById('user-name-display');
        expect(nameDisplay?.textContent).toBe('Test'); // First name only
        
        const modalName = document.getElementById('modal-user-name');
        expect(modalName?.textContent).toBe('Test User');
    });

    it('should update connection status', () => {
        // Mock navigator.onLine
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: true
        });

        manager = new UserProfileManager();
        const statusIndicator = document.getElementById('connection-status');
        // happy-dom keeps the set value
        expect(statusIndicator?.style.backgroundColor).toBe('#4CAF50');

        // Simulate offline
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: false
        });
        window.dispatchEvent(new Event('offline'));
        
        expect(statusIndicator?.style.backgroundColor).toBe('#f44336');
    });

    it('should handle photo upload validation (valid file)', async () => {
        const mockProfile = { name: 'User', username: 'u@e.c' };
        sessionStorage.setItem('userAccount', JSON.stringify(mockProfile));
        manager = new UserProfileManager();

        // Mock FileReader
        let mockReaderInstance: any;
        class MockFileReader {
            readAsDataURL = vi.fn();
            onload: any = null;
            result = 'base64data';
            constructor() {
                mockReaderInstance = this;
            }
        }
        window.FileReader = MockFileReader as any;

        // Trigger upload
        const input = document.getElementById('profile-photo-input') as HTMLInputElement;
        const file = new File(['(⌐□_□)'], 'cool.png', { type: 'image/png' });
        
        // Use spyOn for files property
        vi.spyOn(input, 'files', 'get').mockReturnValue([file] as any);

        // Trigger change
        input.dispatchEvent(new Event('change'));

        // Since FileReader is async, we need to manually trigger onload
        await vi.waitFor(() => expect(mockReaderInstance.readAsDataURL).toHaveBeenCalled());
        
        if (mockReaderInstance.onload) {
            mockReaderInstance.onload({ target: { result: 'base64data' } } as any);
        }

        // Verify storage updated
        const stored = JSON.parse(sessionStorage.getItem('userAccount')!);
        expect(stored.photo).toBe('base64data');
    });

    it('should reject invalid file types', () => {
        window.alert = vi.fn();
        manager = new UserProfileManager();

        const input = document.getElementById('profile-photo-input') as HTMLInputElement;
        const file = new File(['text'], 'bad.txt', { type: 'text/plain' });
        
        // Use spyOn for files property
        vi.spyOn(input, 'files', 'get').mockReturnValue([file] as any);

        input.dispatchEvent(new Event('change'));

        expect(window.alert).toHaveBeenCalledWith('Por favor selecciona una imagen (JPG, PNG).');
    });
});
