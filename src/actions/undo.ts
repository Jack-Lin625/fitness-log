/**
 * 刪除後可以復原：不再先跳確認對話框，刪除後顯示「復原」按鈕幾秒鐘。
 * 比確認對話框更不容易誤刪（確認對話框容易習慣性按下去），在健身房單手操作也比較快。
 */
import { showToast, showUndoToast } from '../components/Toast';
import { errorMessage } from '../lib/errors';

/**
 * 執行刪除並顯示復原按鈕。
 * 回傳是否刪除成功；afterExpire 在沒有復原時才執行（例如真正刪掉照片這類無法復原的清理）。
 */
export async function deleteWithUndo(opts: {
  message: string;
  remove: () => Promise<void>;
  restore: () => Promise<void>;
  afterExpire?: () => void;
}): Promise<boolean> {
  try {
    await opts.remove();
  } catch (err) {
    showToast(errorMessage(err));
    return false;
  }
  void showUndoToast(opts.message, opts.restore).then((undone) => {
    if (!undone) opts.afterExpire?.();
  });
  return true;
}
