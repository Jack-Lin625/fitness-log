import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentToast, showToast, UNDO_MS } from '../components/Toast';
import { deleteWithUndo } from './undo';

describe('deleteWithUndo（刪除後可以復原）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const setup = () => {
    const calls: string[] = [];
    const opts = {
      message: '已刪除訓練',
      remove: vi.fn(async () => void calls.push('remove')),
      restore: vi.fn(async () => void calls.push('restore')),
      afterExpire: vi.fn(() => void calls.push('expire')),
    };
    return { calls, opts };
  };

  it('立刻刪除並顯示「復原」按鈕；按了就還原，不做最後的清理', async () => {
    const { calls, opts } = setup();
    expect(await deleteWithUndo(opts)).toBe(true);
    expect(currentToast()).toMatchObject({ message: '已刪除訓練', action: { label: '復原' } });

    currentToast()!.action!.run();
    await vi.advanceTimersByTimeAsync(UNDO_MS + 1000);
    expect(calls).toEqual(['remove', 'restore']);
    expect(currentToast()).toBeNull();
  });

  it('沒按復原：時間到才做最後的清理（例如刪照片）', async () => {
    const { calls, opts } = setup();
    await deleteWithUndo(opts);
    await vi.advanceTimersByTimeAsync(UNDO_MS - 100);
    expect(opts.afterExpire).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toEqual(['remove', 'expire']);
  });

  it('被新的提示取代時也視為不復原', async () => {
    const { opts } = setup();
    await deleteWithUndo(opts);
    showToast('別的訊息');
    await vi.advanceTimersByTimeAsync(0);
    expect(opts.afterExpire).toHaveBeenCalledTimes(1);
    expect(opts.restore).not.toHaveBeenCalled();
  });

  it('刪除失敗時不顯示復原按鈕，回傳 false', async () => {
    const { opts } = setup();
    opts.remove.mockRejectedValueOnce(new Error('儲存空間已滿'));
    expect(await deleteWithUndo(opts)).toBe(false);
    expect(currentToast()?.message).toBe('儲存空間已滿');
    expect(currentToast()?.action).toBeUndefined();
  });
});
