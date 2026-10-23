import { describe, expect, it } from 'vitest';
import { decideSync, hasValidToken, parseMeta, planPhotoSync, referencedPhotoIds } from './cloudSync';

const cloud = { id: 'f1', modifiedTime: '2026-10-23T02:00:00.000Z', size: 100 };

describe('decideSync（不能用空白或舊資料蓋掉雲端）', () => {
  it('雲端沒有備份：有資料就上傳，沒資料什麼都不做', () => {
    expect(decideSync({ localHasData: true, cloud: null, lastUploadedModified: undefined })).toEqual({ kind: 'upload' });
    expect(decideSync({ localHasData: false, cloud: null, lastUploadedModified: undefined })).toEqual({ kind: 'nothing' });
  });

  it('雲端是這台上次上傳的：直接覆蓋', () => {
    expect(decideSync({ localHasData: true, cloud, lastUploadedModified: cloud.modifiedTime })).toEqual({ kind: 'upload' });
  });

  it('這台沒有資料（新手機）：建議還原，絕不上傳', () => {
    expect(decideSync({ localHasData: false, cloud, lastUploadedModified: cloud.modifiedTime }).kind).toBe('restore');
    expect(decideSync({ localHasData: false, cloud, lastUploadedModified: undefined }).kind).toBe('restore');
  });

  it('雲端被別台裝置改過，或這台從沒上傳過：讓使用者選', () => {
    expect(decideSync({ localHasData: true, cloud, lastUploadedModified: '2026-10-22T00:00:00.000Z' }).kind).toBe('conflict');
    expect(decideSync({ localHasData: true, cloud, lastUploadedModified: undefined }).kind).toBe('conflict');
  });
});

describe('parseMeta / hasValidToken', () => {
  it('格式錯誤或沒開啟視為關閉', () => {
    expect(parseMeta(null)).toEqual({ enabled: false, dirty: false });
    expect(parseMeta('{broken')).toEqual({ enabled: false, dirty: false });
    expect(parseMeta('{"enabled":false,"dirty":true}')).toEqual({ enabled: false, dirty: false });
  });

  it('只保留型別正確的欄位；權杖要有到期時間才算', () => {
    const meta = parseMeta(JSON.stringify({ enabled: true, dirty: true, fileId: 'f', lastUploadAt: 'x', token: 't' }));
    expect(meta).toEqual({ enabled: true, dirty: true, fileId: 'f' });
  });

  it('權杖過期判斷', () => {
    expect(hasValidToken({ enabled: true, dirty: false, token: 't', tokenExpiresAt: 2000 }, 1000)).toBe(true);
    expect(hasValidToken({ enabled: true, dirty: false, token: 't', tokenExpiresAt: 1000 }, 1000)).toBe(false);
    expect(hasValidToken({ enabled: true, dirty: false }, 1000)).toBe(false);
  });
});

describe('照片同步', () => {
  const data = {
    foodEntries: [
      { id: 'f1', date: '2026-10-20', meal: 'lunch' as const, name: '便當', kcal: 700, photoId: 'p-food', createdAt: 1 },
      { id: 'f2', date: '2026-10-20', meal: 'dinner' as const, name: '麵', kcal: 600, createdAt: 2 },
    ],
    bodyMetrics: [
      { id: 'b1', date: '2026-10-20', photos: [{ pose: 'front' as const, photoId: 'p-front' }, { pose: 'side' as const, photoId: 'p-side' }] },
      { id: 'b2', date: '2026-10-21', weight: 75 },
    ],
  };

  it('找出紀錄裡用到的照片（飲食與體態）', () => {
    expect([...referencedPhotoIds(data)].sort()).toEqual(['p-food', 'p-front', 'p-side']);
  });

  it('這台有的上傳、雲端有的下載；兩邊都沒有的不管', () => {
    const plan = planPhotoSync({
      referenced: new Set(['a', 'b', 'c', 'gone']),
      local: new Set(['a', 'c', 'extra']),
      remote: new Map([
        ['b', 'file-b'],
        ['c', 'file-c'],
      ]),
      prune: false,
    });
    expect(plan).toEqual({ upload: ['a'], download: [{ id: 'b', fileId: 'file-b' }], remove: [] });
  });

  it('紀錄用不到的雲端照片：只有 prune 時才刪（避免刪掉別台還在用的）', () => {
    const input = { referenced: new Set(['a']), local: new Set(['a']), remote: new Map([['a', 'fa'], ['old', 'f-old']]) };
    expect(planPhotoSync({ ...input, prune: false }).remove).toEqual([]);
    expect(planPhotoSync({ ...input, prune: true }).remove).toEqual(['f-old']);
  });
});
