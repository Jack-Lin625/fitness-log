import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportPhotosJson, formatBytes, importPhotosJson } from '../lib/photos';
import { clearPhotos, deletePhoto, getAllPhotos, getPhoto, photoUsage, savePhoto } from './photoStore';

const bytesOf = async (blob: Blob | undefined) => [...new Uint8Array(await blob!.arrayBuffer())];
const photo = (...bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

describe('photoStore（IndexedDB）', () => {
  beforeEach(() => clearPhotos());

  it('存入後讀得回來，內容與格式不變', async () => {
    const id = await savePhoto(photo(1, 2, 3));
    const blob = await getPhoto(id);
    expect(blob?.type).toBe('image/jpeg');
    expect(await bytesOf(blob)).toEqual([1, 2, 3]);
  });

  it('可以指定 id（匯入備份時保留原本的 id）', async () => {
    await savePhoto(photo(9), 'keep-this-id');
    expect(await bytesOf(await getPhoto('keep-this-id'))).toEqual([9]);
  });

  it('刪除、清空', async () => {
    const a = await savePhoto(photo(1));
    await savePhoto(photo(2));
    await deletePhoto(a);
    expect(await getPhoto(a)).toBeUndefined();
    expect((await getAllPhotos()).length).toBe(1);
    await clearPhotos();
    expect(await photoUsage()).toEqual({ count: 0, bytes: 0 });
  });

  it('統計張數與大小', async () => {
    await savePhoto(photo(1, 2, 3));
    await savePhoto(photo(4, 5));
    expect(await photoUsage()).toEqual({ count: 2, bytes: 5 });
  });
});

describe('照片備份檔', () => {
  beforeEach(() => clearPhotos());

  it('匯出後清空、再匯入：id 與內容都還原', async () => {
    // 含 0–255 所有位元組，確認 base64 轉換沒有遺漏
    const all = Array.from({ length: 256 }, (_, i) => i);
    await savePhoto(photo(...all), 'p1');
    await savePhoto(new Blob([new Uint8Array([7, 7])], { type: 'image/png' }), 'p2');

    const { json, count } = await exportPhotosJson();
    expect(count).toBe(2);
    await clearPhotos();

    expect(await importPhotosJson(json)).toBe(2);
    expect(await bytesOf(await getPhoto('p1'))).toEqual(all);
    expect((await getPhoto('p2'))?.type).toBe('image/png');
  });

  it('大照片（超過分段大小）也能正確轉換', async () => {
    const big = Array.from({ length: 100_000 }, (_, i) => (i * 31) % 256);
    await savePhoto(photo(...big), 'big');
    const { json } = await exportPhotosJson();
    await clearPhotos();
    await importPhotosJson(json);
    expect(await bytesOf(await getPhoto('big'))).toEqual(big);
  });

  it('選錯檔案時給看得懂的錯誤訊息', async () => {
    await expect(importPhotosJson('not json')).rejects.toThrow('JSON 格式錯誤');
    await expect(importPhotosJson(JSON.stringify({ version: 4, sessions: [] }))).rejects.toThrow('這不是照片備份檔');
  });

  it('檔案大小的顯示', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(250 * 1024)).toBe('250 KB');
    expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });
});
