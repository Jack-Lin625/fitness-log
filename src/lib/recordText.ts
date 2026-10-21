import { formatNumber } from './number';
import type { NewRecord } from './records';

const KIND_LABEL = { weight: '最大重量', e1rm: '估算 1RM', reps: '最多次數' } as const;

/** 一筆新紀錄的說明，例如「估算 1RM 120 kg（100×5，RPE 8）」 */
export function describeRecord(r: NewRecord): string {
  const rpe = r.set.rpe !== undefined ? `，RPE ${formatNumber(r.set.rpe)}` : '';
  if (r.kind === 'reps') return `${KIND_LABEL.reps} ${r.value} 下${rpe ? `（${rpe.slice(1)}）` : ''}`;
  const value = r.kind === 'e1rm' ? formatNumber(Math.round(r.value * 10) / 10) : formatNumber(r.value);
  return `${KIND_LABEL[r.kind]} ${value} kg（${formatNumber(r.set.weight)}×${r.set.reps}${rpe}）`;
}

/** 完成訓練時的提示文字；沒有新紀錄回傳空字串 */
export function describeRecords(records: NewRecord[], nameOf: (exerciseId: string) => string): string {
  if (records.length === 0) return '';
  const exerciseIds = [...new Set(records.map((r) => r.exerciseId))];
  if (exerciseIds.length > 1) return `已儲存，${exerciseIds.length} 個動作破了個人紀錄`;

  // 同一個動作：列出所有破的項目，最後附上那組的次數與 RPE
  const r0 = records[0]!;
  const parts = records.map((r) => describeRecord(r).replace(/（.*）$/, ''));
  return `新紀錄：${nameOf(r0.exerciseId)} ${parts.join('、')}${describeRecord(r0).match(/（.*）$/)?.[0] ?? ''}`;
}
