import { beforeEach, describe, expect, it } from 'vitest';
import { installMemoryStorage } from '../test/memoryStorage';
import type { WorkoutSession } from '../types/models';
import { LocalStorageAdapter } from './localStorageAdapter';
import { Repository } from './repository';

const storage = installMemoryStorage();

const workout = (id: string, date: string, createdAt: number, weight: number): WorkoutSession => ({
  id,
  date,
  createdAt,
  updatedAt: createdAt,
  exercises: [{ exerciseId: 'squat', sets: [{ weight, reps: 5 }] }],
});

async function freshRepo() {
  const repo = new Repository(new LocalStorageAdapter());
  await repo.init();
  return repo;
}

describe('Repository', () => {
  beforeEach(() => storage.reset());

  describe('啟動', () => {
    it('沒有資料時以空白資料啟動', async () => {
      const repo = await freshRepo();
      expect(repo.loadStatus).toEqual({ ok: true, isNew: true });
      expect(repo.getSessions()).toEqual([]);
    });

    it('資料損毀時另存備份、以空白資料啟動，並回報錯誤', async () => {
      storage.store.set('fitlog:data', '{broken');
      const repo = await freshRepo();
      expect(repo.loadStatus).toMatchObject({ ok: false });
      expect([...storage.store.values()]).toContain('{broken');
      expect(repo.getSessions()).toEqual([]);
    });
  });

  describe('動作', () => {
    it('getExercise 找得到內建動作', async () => {
      expect((await freshRepo()).getExercise('squat')?.name).toBe('深蹲');
    });

    it('新增、封存自訂動作後，查詢結果跟著更新', async () => {
      const repo = await freshRepo();
      const custom = await repo.addCustomExercise({ name: '測試動作', bodyPart: 'legs', isBodyweight: false, equipment: 'other' });
      expect(repo.getExercise(custom.id)?.name).toBe('測試動作');
      expect(repo.getExercises().some((e) => e.id === custom.id)).toBe(true);

      await repo.archiveCustomExercise(custom.id);
      expect(repo.getExercises().some((e) => e.id === custom.id)).toBe(false);
      expect(repo.getExercises(true).some((e) => e.id === custom.id)).toBe(true);
      // 舊紀錄仍要能顯示名稱
      expect(repo.getExercise(custom.id)?.archived).toBe(true);
    });
  });

  describe('訓練', () => {
    it('依日期新到舊排序，回傳的陣列改了也不影響內部', async () => {
      const repo = await freshRepo();
      await repo.saveSession(workout('a', '2026-10-01', 1, 60));
      await repo.saveSession(workout('b', '2026-10-05', 2, 70));
      repo.getSessions().reverse();
      expect(repo.getSessions().map((s) => s.id)).toEqual(['b', 'a']);
    });

    it('同一天依建立時間排序', async () => {
      const repo = await freshRepo();
      await repo.saveSession(workout('早上', '2026-10-01', 1, 60));
      await repo.saveSession(workout('晚上', '2026-10-01', 2, 60));
      expect(repo.getSessions().map((s) => s.id)).toEqual(['晚上', '早上']);
    });

    it('新增、刪除紀錄後，排序與「上次」跟著更新', async () => {
      const repo = await freshRepo();
      await repo.saveSession(workout('a', '2026-10-01', 1, 60));
      await repo.saveSession(workout('b', '2026-10-05', 2, 70));
      expect(repo.getLastPerformance('squat')?.sets[0]?.weight).toBe(70);

      await repo.saveSession(workout('c', '2026-10-09', 3, 80));
      expect(repo.getSessions().map((s) => s.id)).toEqual(['c', 'b', 'a']);
      expect(repo.getLastPerformance('squat')?.sets[0]?.weight).toBe(80);
      // 修改 c 時，「上次」要排除 c 本身
      expect(repo.getLastPerformance('squat', 'c')?.sets[0]?.weight).toBe(70);

      await repo.deleteSession('c');
      expect(repo.getSessions().map((s) => s.id)).toEqual(['b', 'a']);
      expect(repo.getRecentExerciseIds(5)).toEqual(['squat']);
    });

    it('寫入失敗時資料維持原樣，不會顯示假的已儲存', async () => {
      const repo = await freshRepo();
      await repo.saveSession(workout('a', '2026-10-01', 1, 60));
      storage.quota = 0;
      await expect(repo.saveSession(workout('b', '2026-10-02', 2, 60))).rejects.toThrow();
      expect(repo.getSessions().map((s) => s.id)).toEqual(['a']);
    });

    it('完成草稿：同一次寫入儲存紀錄並清除草稿', async () => {
      const repo = await freshRepo();
      await repo.saveDraft({ id: 'd', date: '2026-10-01', exercises: [], note: '', startedAt: 0 });
      await repo.finishDraft(workout('d', '2026-10-01', 1, 60));
      expect(repo.getDraft()).toBeNull();
      expect(repo.getSession('d')).toBeDefined();
    });
  });

  it('寫入後通知訂閱者，取消訂閱後不再通知', async () => {
    const repo = await freshRepo();
    let calls = 0;
    const unsubscribe = repo.subscribe(() => calls++);
    await repo.updateSettings({ barWeight: 15 });
    unsubscribe();
    await repo.updateSettings({ barWeight: 20 });
    expect(calls).toBe(1);
  });

  it('clearAll 後所有資料與快取都清空', async () => {
    const repo = await freshRepo();
    const custom = await repo.addCustomExercise({ name: 'x', bodyPart: 'arms', isBodyweight: false, equipment: 'other' });
    await repo.saveSession(workout('a', '2026-10-01', 1, 60));
    await repo.clearAll();
    expect(repo.getSessions()).toEqual([]);
    expect(repo.getExercise(custom.id)).toBeUndefined();
    expect(storage.store.size).toBe(0);
  });
});
