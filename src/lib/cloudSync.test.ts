import { describe, expect, it } from 'vitest';
import { decideSync, hasValidToken, parseMeta } from './cloudSync';

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
