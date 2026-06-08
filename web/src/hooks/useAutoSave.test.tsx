import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';
import { AUTO_SAVE_INTERVAL } from '../config/constants';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutoSave', () => {
  it('calls onSave every AUTO_SAVE_INTERVAL when enabled and hasUnsaved', () => {
    const onSave = vi.fn();
    renderHook(() => useAutoSave({ enabled: true, hasUnsaved: true, onSave }));

    act(() => vi.advanceTimersByTime(AUTO_SAVE_INTERVAL));
    expect(onSave).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(AUTO_SAVE_INTERVAL));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('does NOT call onSave when enabled but hasUnsaved is false', () => {
    const onSave = vi.fn();
    renderHook(() => useAutoSave({ enabled: true, hasUnsaved: false, onSave }));

    act(() => vi.advanceTimersByTime(AUTO_SAVE_INTERVAL * 3));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does NOT call onSave when not enabled', () => {
    const onSave = vi.fn();
    renderHook(() => useAutoSave({ enabled: false, hasUnsaved: true, onSave }));

    act(() => vi.advanceTimersByTime(AUTO_SAVE_INTERVAL * 3));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('clears the interval on unmount — no calls after unmount', () => {
    const onSave = vi.fn();
    const { unmount } = renderHook(() => useAutoSave({ enabled: true, hasUnsaved: true, onSave }));

    act(() => vi.advanceTimersByTime(AUTO_SAVE_INTERVAL));
    expect(onSave).toHaveBeenCalledTimes(1);

    unmount();
    act(() => vi.advanceTimersByTime(AUTO_SAVE_INTERVAL * 5));
    expect(onSave).toHaveBeenCalledTimes(1); // still 1, no new calls after unmount
  });

  it('uses the latest hasUnsaved via ref — stopping saves when flipped to false without reinstalling interval', () => {
    const onSave = vi.fn();
    let hasUnsaved = true;
    const { rerender } = renderHook(() => useAutoSave({ enabled: true, hasUnsaved, onSave }));

    act(() => vi.advanceTimersByTime(AUTO_SAVE_INTERVAL));
    expect(onSave).toHaveBeenCalledTimes(1);

    // Flip hasUnsaved to false — rerender with new value
    hasUnsaved = false;
    rerender();

    act(() => vi.advanceTimersByTime(AUTO_SAVE_INTERVAL));
    expect(onSave).toHaveBeenCalledTimes(1); // no new call — hasUnsaved is now false
  });

  it('uses the latest onSave via ref — calls the newest callback without reinstalling interval', () => {
    const onSaveV1 = vi.fn();
    const onSaveV2 = vi.fn();
    let onSave = onSaveV1;
    const { rerender } = renderHook(() => useAutoSave({ enabled: true, hasUnsaved: true, onSave }));

    act(() => vi.advanceTimersByTime(AUTO_SAVE_INTERVAL));
    expect(onSaveV1).toHaveBeenCalledTimes(1);

    // Swap callback — must not tear down and reinstall the interval
    onSave = onSaveV2;
    rerender();

    act(() => vi.advanceTimersByTime(AUTO_SAVE_INTERVAL));
    expect(onSaveV1).toHaveBeenCalledTimes(1); // old one not called again
    expect(onSaveV2).toHaveBeenCalledTimes(1); // new one called
  });
});
