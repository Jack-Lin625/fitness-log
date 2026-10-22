import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMemoryStorage } from '../test/memoryStorage';
import { LocalStorageAdapter } from './localStorageAdapter';
import { createEmptyData } from './migrations';
import { Repository } from './repository';
import type { WorkoutSession } from '../types/models';

const storage = installMemoryStorage();
const backups = () => [...storage.store.keys()].filter((k) => k.startsWith('fitlog:backup:')).sort();

describe('LocalStorageAdapter 本機備份', () => {
  beforeEach(() => {
    storage.reset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T08:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  /** 換一份主資料並備份；每次往後推一秒，讓備份名稱的時間不同 */
  const backupVersion = async (adapter: LocalStorageAdapter, n: number) => {
    storage.store.set('fitlog:data', `{"version":3,"n":${n}}`);
    vi.advanceTimersByTime(1000);
    return adapter.backupRaw('before-import');
  };

  it('沒有主資料時不備份', async () => {
    expect(await new LocalStorageAdapter().backupRaw('x')).toBeNull();
    expect(backups()).toEqual([]);
  });

  it('內容相同的備份不重複存，回傳既有的備份名稱', async () => {
    const adapter = new LocalStorageAdapter();
    const first = await backupVersion(adapter, 1);
    const second = await backupVersion(adapter, 1);
    expect(second).toBe(first);
    expect(backups()).toHaveLength(1);
  });

  it('最多保留最新的 3 份', async () => {
    const adapter = new LocalStorageAdapter();
    for (let n = 1; n <= 6; n++) await backupVersion(adapter, n);
    expect(backups().map((k) => storage.store.get(k))).toEqual([
      '{"version":3,"n":4}',
      '{"version":3,"n":5}',
      '{"version":3,"n":6}',
    ]);
  });

  it('clear() 刪除主資料與所有備份', async () => {
    const adapter = new LocalStorageAdapter();
    await backupVersion(adapter, 1);
    await adapter.clear();
    expect(storage.store.size).toBe(0);
  });

  it('容量滿了時寫入失敗會變成使用者看得懂的訊息', async () => {
    storage.quota = 10;
    await expect(new LocalStorageAdapter().save(createEmptyData())).rejects.toThrow('儲存空間已滿');
  });

  it('連續匯入 10 次後，備份不會吃掉新增訓練需要的空間', async () => {
    // 約 300 筆訓練的資料量；容量上限設為資料的 5.5 倍（模擬 5MB 上限、資料約 0.9MB）
    const workout = (id: string, createdAt: number): WorkoutSession => ({
      id,
      date: '2026-01-01',
      createdAt,
      updatedAt: createdAt,
      note: '今天狀況不錯',
      exercises: ['squat', 'bench-press', 'deadlift', 'lat-pulldown'].map((exerciseId) => ({
        exerciseId,
        sets: [{ weight: 80, reps: 5, rpe: 8 }, { weight: 80, reps: 5 }, { weight: 80, reps: 5 }],
      })),
    });
    const data = { ...createEmptyData(), sessions: Array.from({ length: 300 }, (_, i) => workout(`r${i}`, i)) };
    storage.store.set('fitlog:data', JSON.stringify(data));
    storage.quota = JSON.stringify(data).length * 5.5;

    const repo = new Repository(new LocalStorageAdapter());
    await repo.init();
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1000);
      // 每次匯入的備份內容略有不同（例如在不同天匯出）
      await repo.replaceAll({ ...data, settings: { ...data.settings, barWeight: 20 + i } });
    }

    let added = 0;
    for (; added < 1000; added++) {
      try {
        await repo.saveSession(workout(`new${added}`, 1000 + added));
      } catch {
        break;
      }
    }
    expect(backups()).toHaveLength(3);
    // 舊版（備份無限累積）在同樣條件下只能再存約 150 筆
    expect(added).toBeGreaterThanOrEqual(300);
  });
});
