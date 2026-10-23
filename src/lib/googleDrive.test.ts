import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BACKUP_FILE_NAME,
  deletePhotoFile,
  downloadBackup,
  downloadPhoto,
  DriveAuthError,
  findBackup,
  listPhotos,
  uploadBackup,
  uploadPhoto,
} from './googleDrive';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function mockFetch(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('googleDrive', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('在 App 專用資料夾找備份檔，帶上存取權杖', async () => {
    const fetchMock = mockFetch(json({ files: [{ id: 'f1', modifiedTime: 't1', size: '42' }] }));
    expect(await findBackup('tok')).toEqual({ id: 'f1', modifiedTime: 't1', size: 42 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('spaces=appDataFolder');
    expect(decodeURIComponent(String(url))).toContain(BACKUP_FILE_NAME);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('沒有備份檔回傳 null', async () => {
    mockFetch(json({ files: [] }));
    expect(await findBackup('tok')).toBeNull();
  });

  it('沒有檔案時建立新檔（放在 appDataFolder），有檔案時覆蓋', async () => {
    const fetchMock = mockFetch(json({ id: 'new', modifiedTime: 't2', size: '5' }), json({ id: 'f1', modifiedTime: 't3' }));
    expect(await uploadBackup('tok', '{"a":1}')).toEqual({ id: 'new', modifiedTime: 't2', size: 5 });
    const [createUrl, create] = fetchMock.mock.calls[0]!;
    expect(String(createUrl)).toContain('uploadType=multipart');
    expect(create?.method).toBe('POST');
    expect(String(create?.body)).toContain('"parents":["appDataFolder"]');
    expect(String(create?.body)).toContain('{"a":1}');

    await uploadBackup('tok', '{"a":2}', 'f1');
    const [updateUrl, update] = fetchMock.mock.calls[1]!;
    expect(String(updateUrl)).toContain('/files/f1?uploadType=media');
    expect(update?.method).toBe('PATCH');
    expect(update?.body).toBe('{"a":2}');
  });

  it('下載內容', async () => {
    mockFetch(new Response('{"version":5}'));
    expect(await downloadBackup('tok', 'f1')).toBe('{"version":5}');
  });

  it('401 代表授權過期；其他錯誤與斷線給看得懂的訊息', async () => {
    mockFetch(new Response('', { status: 401 }));
    await expect(findBackup('tok')).rejects.toBeInstanceOf(DriveAuthError);
    mockFetch(new Response('{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}', { status: 403 }));
    await expect(uploadBackup('tok', '{}')).rejects.toThrow('空間已滿');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(findBackup('tok')).rejects.toThrow('請確認網路');
  });

  it('照片：列出全部（跨頁），只認 photo- 開頭的檔名', async () => {
    const fetchMock = mockFetch(
      json({ nextPageToken: 'p2', files: [{ id: 'f1', name: 'photo-a' }, { id: 'x', name: 'fitlog-backup.json' }] }),
      json({ files: [{ id: 'f2', name: 'photo-b' }] }),
    );
    expect(await listPhotos('tok')).toEqual(new Map([['a', 'f1'], ['b', 'f2']]));
    expect(String(fetchMock.mock.calls[1]![0])).toContain('pageToken=p2');
  });

  it('照片：上傳時檔名帶照片 id、內容是原本的位元組；下載、刪除', async () => {
    const fetchMock = mockFetch(json({ id: 'f1' }), new Response(new Uint8Array([7, 8])), new Response(null, { status: 204 }));
    await uploadPhoto('tok', 'abc', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
    const body = fetchMock.mock.calls[0]![1]!.body as Blob;
    const text = await body.text();
    expect(text).toContain('"name":"photo-abc"');
    expect(text).toContain('"parents":["appDataFolder"]');
    expect(text).toContain('Content-Type: image/jpeg\r\n\r\n\u0001\u0002\u0003\r\n');

    expect([...new Uint8Array(await (await downloadPhoto('tok', 'f1')).arrayBuffer())]).toEqual([7, 8]);
    await deletePhotoFile('tok', 'f1');
    expect(fetchMock.mock.calls[2]![1]!.method).toBe('DELETE');
  });

  it('照片：刪除已經不在的檔案不算錯誤', async () => {
    mockFetch(new Response('', { status: 404 }));
    await expect(deletePhotoFile('tok', 'gone')).resolves.toBeUndefined();
  });
});
