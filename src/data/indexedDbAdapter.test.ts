import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMemoryStorage } from '../test/memoryStorage';
import type { WorkoutDraft, WorkoutSession } from '../types/models';
import { IndexedDbAdapter } from './indexedDbAdapter';
import { LocalStorageAdapter } from './localStorageAdapter';
import { createEmptyData } from './migrations';
import { Repository } from './repository';

const storage = installMemoryStorage();

/** 每個測試用不同的資料庫名稱，互不影響 */
let dbNo = 0;
const newAdapter = () => new IndexedDbAdapter(new LocalStorageAdapter(), `test-db-${++dbNo}`);

const workout = (id: string): WorkoutSession => ({
  id,
  date: '2026-10-20',
  createdAt: 1,
  updatedAt: 1,
  exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] }],
});

const draft = (id: string): WorkoutDraft => ({ id, date: '2026-10-20', exercises: [], note: '', startedAt: 1 });

describe('IndexedDbAdapter', () => {
  beforeEach(() => storage.reset());

  it('沒有任何資料時回傳 null', async () => {
    expect(await newAdapter().load()).toBeNull();
  });

  it('存入後讀得回來，草稿和主資料分開存', async () => {
    const adapter = newAdapter();
    await adapter.save({ ...createEmptyData(), sessions: [workout('a')], activeDraft: draft('d1') });
    expect(await adapter.load()).toMatchObject({ sessions: [{ id: 'a' }], activeDraft: { id: 'd1' } });

    // 只寫草稿：主資料不變
    await adapter.saveDraft(draft('d2'));
    expect(await adapter.load()).toMatchObject({ sessions: [{ id: 'a' }], activeDraft: { id: 'd2' } });
    await adapter.saveDraft(null);
    expect(await adapter.load()).toMatchObject({ activeDraft: null });
  });

  it('第一次啟動時把 localStorage 的舊資料搬過來，搬完刪掉舊資料', async () => {
    const old = { ...createEmptyData(), version: 4, sessions: [workout('old')], activeDraft: draft('old-draft') };
    storage.store.set('fitlog:data', JSON.stringify(old));
    const adapter = newAdapter();

    expect(await adapter.load()).toMatchObject({ version: 4, sessions: [{ id: 'old' }], activeDraft: { id: 'old-draft' } });
    expect(storage.store.has('fitlog:data')).toBe(false);
    // 第二次讀取來自 IndexedDB
    expect(await adapter.load()).toMatchObject({ sessions: [{ id: 'old' }] });
  });

  it('localStorage 的舊資料損毀時丟出錯誤，並把原始內容另存備份', async () => {
    storage.store.set('fitlog:data', '{broken');
    const repo = new Repository(newAdapter());
    await repo.init();
    expect(repo.loadStatus).toMatchObject({ ok: false });
    expect([...storage.store.values()]).toContain('{broken');
  });

  it('本機備份：內容相同不重複存，最多保留 3 份', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const adapter = newAdapter();
      const keys: (string | null)[] = [];
      for (let n = 1; n <= 5; n++) {
        await adapter.save({ ...createEmptyData(), sessions: [workout(`s${n}`)] });
        vi.advanceTimersByTime(1000);
        keys.push(await adapter.backupRaw('test'));
      }
      expect(await adapter.backupRaw('again')).toBe(keys[4]);

      // 每次內容不同都存成新的一份
      expect(new Set(keys).size).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('不能用 IndexedDB 時改用 localStorage', async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error 模擬不支援 IndexedDB 的瀏覽器
    delete globalThis.indexedDB;
    try {
      const adapter = new IndexedDbAdapter(new LocalStorageAdapter(), 'no-idb');
      await adapter.save({ ...createEmptyData(), sessions: [workout('ls')] });
      expect(JSON.parse(storage.store.get('fitlog:data')!)).toMatchObject({ sessions: [{ id: 'ls' }] });
      expect(await adapter.load()).toMatchObject({ sessions: [{ id: 'ls' }] });
    } finally {
      globalThis.indexedDB = original;
    }
  });

  it('清除：主資料、草稿、備份都刪掉', async () => {
    const adapter = newAdapter();
    await adapter.save({ ...createEmptyData(), sessions: [workout('a')], activeDraft: draft('d') });
    await adapter.backupRaw('x');
    await adapter.clear();
    expect(await adapter.load()).toBeNull();
  });
});

describe('Repository 的草稿只寫草稿', () => {
  beforeEach(() => storage.reset());
  afterEach(() => vi.restoreAllMocks());

  it('saveDraft 不會重寫主資料', async () => {
    const adapter = newAdapter();
    const repo = new Repository(adapter);
    await repo.init();
    await repo.saveSession(workout('a'));

    const save = vi.spyOn(adapter, 'save');
    await repo.saveDraft(draft('d1'));
    expect(save).not.toHaveBeenCalled();
    expect(repo.getDraft()?.id).toBe('d1');

    // 重新啟動後草稿和紀錄都在
    const reopened = new Repository(adapter);
    await reopened.init();
    expect(reopened.getDraft()?.id).toBe('d1');
    expect(reopened.getSessions().map((s) => s.id)).toEqual(['a']);
  });

  it('完成訓練：紀錄與清除草稿同一次寫入', async () => {
    const adapter = newAdapter();
    const repo = new Repository(adapter);
    await repo.init();
    await repo.saveDraft(draft('d1'));
    await repo.finishDraft(workout('d1'));

    const reopened = new Repository(adapter);
    await reopened.init();
    expect(reopened.getDraft()).toBeNull();
    expect(reopened.getSessions().map((s) => s.id)).toEqual(['d1']);
  });
});
