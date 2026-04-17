import { ViewpointRepository } from '../viewpoint-repository';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn();
global.URL.revokeObjectURL = vi.fn();

describe('ViewpointRepository', () => {
    let repo: ViewpointRepository;

    beforeEach(() => {
        repo = new ViewpointRepository();
        mockFetch.mockReset();
    });

    it('should load the index correctly', async () => {
        const mockIndex = [
            { id: '1', title: 'View 1', description: '', category: 'General', userId: 'user@example.com', date: Date.now(), file: 'https://example.com/view1.json' }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockIndex
        });

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });

        const index = await repo.loadIndex('user@example.com');
        expect(index).toEqual(mockIndex);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(String(mockFetch.mock.calls[0][0])).toContain('action=list');
        expect(String(mockFetch.mock.calls[0][0])).toContain('userId=');
    });

    it('should handle 404 when loading index', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });

        const index = await repo.loadIndex();
        expect(index).toEqual([]);
    });

    it('should load and validate valid viewpoint data', async () => {
        const validView = {
            id: '123',
            userId: 'user',
            title: 'Test View',
            camera: { position: [0,0,0], target: [0,0,0], projection: 'perspective' }
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => validView
        });

        const data = await repo.loadViewpointData('VIEWS/view1.json');
        expect(data).toEqual(validView);
    });

    it('should reject invalid viewpoint data', async () => {
        const invalidView = {
            id: '123'
            // Missing title, camera, etc.
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => invalidView
        });

        const data = await repo.loadViewpointData('VIEWS/invalid.json');
        expect(data).toBeNull();
    });

    it('should handle fetch errors when loading view', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));
        const data = await repo.loadViewpointData('VIEWS/error.json');
        expect(data).toBeNull();
    });
});
