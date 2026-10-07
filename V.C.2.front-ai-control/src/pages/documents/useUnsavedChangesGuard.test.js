// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard.js';

const SETTLE_MS = 400;

function setup(initial = {}) {
  const onSave = initial.onSave ?? vi.fn(async () => true);
  const hook = renderHook((props) => useUnsavedChangesGuard(props), {
    initialProps: { fingerprint: 'a', ready: true, enabled: true, onSave, ...initial },
  });
  act(() => {
    vi.advanceTimersByTime(SETTLE_MS);
  });
  return { ...hook, onSave };
}

describe('useUnsavedChangesGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('is clean right after load and closes without asking', () => {
    const { result } = setup();
    const close = vi.fn();
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.requestLeave(close));
    expect(close).toHaveBeenCalledTimes(1);
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('absorbs normalisation that happens while the editor settles', () => {
    const { result, rerender, onSave } = renderHook((props) => useUnsavedChangesGuard(props), {
      initialProps: { fingerprint: 'raw', ready: true, onSave: vi.fn() },
    });
    rerender({ fingerprint: 'normalised', ready: true, onSave });
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS);
    });
    expect(result.current.isDirty).toBe(false);
  });

  it('asks before closing when there are edits; «Отмена» keeps the editor open', () => {
    const { result, rerender, onSave } = setup();
    rerender({ fingerprint: 'b', ready: true, enabled: true, onSave });
    expect(result.current.isDirty).toBe(true);

    const close = vi.fn();
    act(() => result.current.requestLeave(close));
    expect(result.current.dialogProps.open).toBe(true);

    act(() => result.current.dialogProps.onCancel());
    expect(result.current.dialogProps.open).toBe(false);
    expect(close).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('«Не сохранять» closes without saving', () => {
    const { result, rerender, onSave } = setup();
    rerender({ fingerprint: 'b', ready: true, enabled: true, onSave });
    const close = vi.fn();
    act(() => result.current.requestLeave(close));
    act(() => result.current.dialogProps.onDiscard());
    expect(close).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('«Сохранить» saves, then closes', async () => {
    const { result, rerender, onSave } = setup();
    rerender({ fingerprint: 'b', ready: true, enabled: true, onSave });
    const close = vi.fn();
    act(() => result.current.requestLeave(close));
    await act(async () => {
      await result.current.dialogProps.onSave();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('keeps the dialog open with an error when saving fails', async () => {
    const onSave = vi.fn(async () => false);
    const { result, rerender } = setup({ onSave });
    rerender({ fingerprint: 'b', ready: true, enabled: true, onSave });
    const close = vi.fn();
    act(() => result.current.requestLeave(close));
    await act(async () => {
      await result.current.dialogProps.onSave();
    });
    expect(close).not.toHaveBeenCalled();
    expect(result.current.dialogProps.open).toBe(true);
    expect(result.current.dialogProps.error).toBeTruthy();
  });

  it('markClean() after a save makes the current state the new baseline', () => {
    const { result, rerender, onSave } = setup();
    rerender({ fingerprint: 'b', ready: true, enabled: true, onSave });
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.markClean());
    expect(result.current.isDirty).toBe(false);
  });

  it('never reports changes in view-only mode', () => {
    const { result, rerender, onSave } = setup({ enabled: false });
    rerender({ fingerprint: 'b', ready: true, enabled: false, onSave });
    expect(result.current.isDirty).toBe(false);
  });

  it('warns on tab close / reload only while dirty', () => {
    const { rerender, onSave } = setup();
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    rerender({ fingerprint: 'b', ready: true, enabled: true, onSave });
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });
});
