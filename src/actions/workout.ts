/**
 * 訓練相關的操作流程（開始、複製、修改、刪除）
 * 集中在這裡，讓紀錄頁和訓練詳情頁共用同一套確認與錯誤處理。
 */
import { confirmDialog } from '../components/Dialog';
import { showToast } from '../components/Toast';
import { repo } from '../data';
import { navigate } from '../hooks/useHashRoute';
import { createEmptyDraft, draftFromSession } from '../lib/draft';
import { errorMessage } from '../lib/errors';
import { stopRest } from '../lib/restTimer';
import type { WorkoutDraft, WorkoutSession } from '../types/models';

/** 已有進行中的訓練時，先確認是否捨棄 */
async function confirmReplaceDraft(): Promise<boolean> {
  const draft = repo.getDraft();
  if (!draft) return true;
  return confirmDialog({
    title: draft.editingSessionId ? '有一筆修改還沒儲存' : '有一個未完成的訓練',
    body: '繼續的話，未儲存的內容會被捨棄。',
    confirmText: '捨棄並繼續',
    danger: true,
  });
}

async function openDraft(draft: WorkoutDraft): Promise<void> {
  if (!(await confirmReplaceDraft())) return;
  try {
    await repo.saveDraft(draft);
    navigate('/log/session');
  } catch (err) {
    showToast(errorMessage(err));
  }
}

/** 開始一個空白訓練 */
export function startNewWorkout(): Promise<void> {
  return openDraft(createEmptyDraft());
}

/** 以某次訓練為範本開始今天的訓練 */
export function startFromSession(session: WorkoutSession): Promise<void> {
  return openDraft(draftFromSession(session, 'template'));
}

/** 修改既有紀錄 */
export function editSession(session: WorkoutSession): Promise<void> {
  return openDraft(draftFromSession(session, 'edit'));
}

/** 回到進行中的訓練 */
export function resumeDraft(): void {
  navigate('/log/session');
}

/** 刪除紀錄（需確認），刪除成功回傳 true */
export async function deleteSession(session: WorkoutSession): Promise<boolean> {
  const ok = await confirmDialog({
    title: '刪除這筆訓練？',
    body: '刪除後無法復原。',
    confirmText: '刪除',
    danger: true,
  });
  if (!ok) return false;
  try {
    await repo.deleteSession(session.id);
    showToast('已刪除訓練');
    return true;
  } catch (err) {
    showToast(errorMessage(err));
    return false;
  }
}

/** 捨棄進行中的訓練（需確認），捨棄後回傳 true */
export async function discardDraft(draft: WorkoutDraft): Promise<boolean> {
  const isEdit = Boolean(draft.editingSessionId);
  const ok = await confirmDialog({
    title: isEdit ? '放棄這次修改？' : '捨棄這次訓練？',
    body: isEdit ? '原本的紀錄不會改變。' : '目前填寫的內容都會刪除。',
    confirmText: isEdit ? '放棄修改' : '捨棄',
    danger: true,
  });
  if (!ok) return false;
  try {
    await repo.clearDraft();
    stopRest();
    return true;
  } catch (err) {
    showToast(errorMessage(err));
    return false;
  }
}
