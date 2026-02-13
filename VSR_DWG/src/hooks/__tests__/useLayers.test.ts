import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLayers } from '../useLayers'
import * as THREE from 'three'

// Mock THREE
vi.mock('three', async () => {
  return {
    ...await vi.importActual('three'),
  }
})

describe('useLayers', () => {
  let mockEntityRoot: any
  let mockFile: any

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear()

    // Setup Mock EntityRoot with traverse
    mockEntityRoot = {
      traverse: vi.fn((callback) => {
        // Mock some objects
        const objects = [
          { userData: { layer: 'Layer1' }, material: { color: { getHexString: () => 'ff0000' } } },
          { userData: { layer: 'Layer2' }, material: { color: { getHexString: () => '00ff00' } } },
          { userData: { layer: 'Layer1' } }, // Duplicate layer
          { userData: {} } // No layer
        ]
        objects.forEach(callback)
      })
    }

    mockFile = { name: 'test.dxf' }
  })

  it('should extract layers from entityRoot', () => {
    const { result } = renderHook(() => useLayers(mockEntityRoot, mockFile))

    expect(mockEntityRoot.traverse).toHaveBeenCalled()
    expect(result.current.layers).toHaveLength(2)
    expect(result.current.layers).toEqual(expect.arrayContaining([
      { name: 'Layer1', color: '#ff0000' },
      { name: 'Layer2', color: '#00ff00' }
    ]))
  })

  it('should initialize visibility to true for all layers', () => {
    const { result } = renderHook(() => useLayers(mockEntityRoot, mockFile))

    expect(result.current.layerVisibility).toEqual({
      'Layer1': true,
      'Layer2': true
    })
  })

  it('should toggle layer visibility', () => {
    const { result } = renderHook(() => useLayers(mockEntityRoot, mockFile))

    act(() => {
      result.current.toggleLayer('Layer1')
    })

    expect(result.current.layerVisibility['Layer1']).toBe(false)
    expect(result.current.layerVisibility['Layer2']).toBe(true)
  })

  it('should not allow hiding the last visible layer', () => {
    const { result } = renderHook(() => useLayers(mockEntityRoot, mockFile))

    // Hide Layer1
    act(() => {
      result.current.toggleLayer('Layer1')
    })
    expect(result.current.layerVisibility['Layer1']).toBe(false)

    // Try to hide Layer2 (should fail)
    act(() => {
      result.current.toggleLayer('Layer2')
    })
    expect(result.current.layerVisibility['Layer2']).toBe(true)
  })

  it('should persist visibility to localStorage', () => {
    const { result } = renderHook(() => useLayers(mockEntityRoot, mockFile))

    act(() => {
      result.current.toggleLayer('Layer1')
    })

    const key = `dwg_layer_config_${mockFile.name}`
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    expect(saved['Layer1']).toBe(false)
  })

  it('should load visibility from localStorage', () => {
    const key = `dwg_layer_config_${mockFile.name}`
    localStorage.setItem(key, JSON.stringify({ 'Layer1': false, 'Layer2': true }))

    const { result } = renderHook(() => useLayers(mockEntityRoot, mockFile))

    expect(result.current.layerVisibility['Layer1']).toBe(false)
    expect(result.current.layerVisibility['Layer2']).toBe(true)
  })
  
  it('should show all layers', () => {
    const { result } = renderHook(() => useLayers(mockEntityRoot, mockFile))

    // Hide Layer1
    act(() => {
       result.current.toggleLayer('Layer1')
    })
    expect(result.current.layerVisibility['Layer1']).toBe(false)
    
    // Show All
    act(() => {
       result.current.showAll()
    })
    expect(result.current.layerVisibility['Layer1']).toBe(true)
    expect(result.current.layerVisibility['Layer2']).toBe(true)
  })
  
  it('should hide all layers but keep one', () => {
    const { result } = renderHook(() => useLayers(mockEntityRoot, mockFile))

    act(() => {
       result.current.hideAll()
    })
    
    // Should keep the first one visible (Layer1 comes before Layer2 alphabetically)
    // Actually sorting is done in extraction.
    // 'Layer1' vs 'Layer2' -> 'Layer1' is first.
    expect(result.current.layerVisibility['Layer1']).toBe(true)
    expect(result.current.layerVisibility['Layer2']).toBe(false)
  })
})
