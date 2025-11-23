import { renderHook, act } from '@testing-library/react';
import { useStickyState } from './useStickyState';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('useStickyState', () => {
    const key = 'test_key';
    const defaultValue = { foo: 'bar' };

    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('should use default value if storage is empty', () => {
        const { result } = renderHook(() => useStickyState(defaultValue, key));
        expect(result.current[0]).toEqual(defaultValue);
    });

    it('should load value from localStorage', () => {
        window.localStorage.setItem(key, JSON.stringify({ foo: 'baz' }));
        const { result } = renderHook(() => useStickyState(defaultValue, key));
        expect(result.current[0]).toEqual({ foo: 'baz' });
    });

    it('should save value to localStorage when updated', () => {
        const { result } = renderHook(() => useStickyState(defaultValue, key));

        act(() => {
            result.current[1]({ foo: 'new' });
        });

        expect(JSON.parse(window.localStorage.getItem(key)!)).toEqual({ foo: 'new' });
    });

    it('should handle corrupted localStorage gracefully', () => {
        // Mock console.warn to keep output clean
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Set invalid JSON
        window.localStorage.setItem(key, 'invalid json');

        const { result } = renderHook(() => useStickyState(defaultValue, key));

        // Should fallback to default value
        expect(result.current[0]).toEqual(defaultValue);
        // Should have warned
        expect(consoleSpy).toHaveBeenCalled();
    });
});
