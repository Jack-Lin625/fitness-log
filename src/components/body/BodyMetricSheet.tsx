import { useEffect, useState } from 'preact/hooks';
import { confirmDialog } from '../Dialog';
import { showToast } from '../Toast';
import { useRepository } from '../../hooks/useRepository';
import { STORED_METRICS, type StoredMetricKey } from '../../lib/bodyMetrics';
import { todayString } from '../../lib/date';
import { errorMessage } from '../../lib/errors';
import { createId } from '../../lib/id';
import { formatNumber, parseNumber, sanitizeDecimalInput } from '../../lib/number';
import type { BodyMetric } from '../../types/models';

type Fields = Record<StoredMetricKey, string>;

const emptyFields = (): Fields => ({ weight: '', bodyFat: '', waist: '', chest: '', arm: '' });

const toFields = (m: BodyMetric | undefined): Fields => {
  const f = emptyFields();
  if (m) for (const def of STORED_METRICS) {
    const v = m[def.key];
    if (v !== undefined) f[def.key] = formatNumber(v);
  }
  return f;
};

interface Props {
  /** 要修改的紀錄；沒有則為新增 */
  initial: BodyMetric | undefined;
  onClose: () => void;
}

/** 新增／修改體態紀錄的全螢幕表單；所有欄位都是選填，但至少要填一項 */
export function BodyMetricSheet({ initial, onClose }: Props) {
  const repo = useRepository();
  const [editing, setEditing] = useState<BodyMetric | undefined>(initial);
  const [date, setDate] = useState(initial?.date ?? todayString());
  const [fields, setFields] = useState<Fields>(() => toFields(initial ?? repo.getBodyMetricByDate(todayString())));
  const [saving, setSaving] = useState(false);

  // 新增時若今天已經有紀錄，直接進入修改模式，避免同一天出現兩筆
  useEffect(() => {
    if (!initial) {
      const existing = repo.getBodyMetricByDate(todayString());
      if (existing) setEditing(existing);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /** 新增模式下切換日期：那天已有紀錄就載入它 */
  const changeDate = (next: string) => {
    if (!next) return;
    setDate(next);
    if (editing && editing.date !== next) return; // 修改模式：只是改日期
    const existing = repo.getBodyMetricByDate(next);
    if (existing) {
      setEditing(existing);
      setFields(toFields(existing));
      showToast('這天已經有紀錄，已載入讓你修改');
    } else if (editing) {
      setEditing(undefined);
    }
  };

  const save = async () => {
    const metric: BodyMetric = { id: editing?.id ?? createId(), date };
    let count = 0;
    for (const def of STORED_METRICS) {
      const raw = fields[def.key];
      if (raw.trim() === '') continue;
      const v = parseNumber(raw);
      if (v === null || v < def.min || v > def.max) {
        return showToast(`${def.label}請輸入 ${def.min}–${def.max} ${def.unit} 之間的數字`);
      }
      metric[def.key] = v;
      count++;
    }
    if (count === 0) return showToast('至少要填一個項目');

    // 日期改到另一天、而那天已有別筆紀錄時，詢問是否取代
    const clash = repo.getBodyMetricByDate(date);
    const removeIds: string[] = [];
    if (clash && clash.id !== metric.id) {
      const ok = await confirmDialog({
        title: '這天已經有紀錄',
        body: '要用這次填的內容取代那天的紀錄嗎？',
        confirmText: '取代',
        danger: true,
      });
      if (!ok) return;
      removeIds.push(clash.id);
    }

    setSaving(true);
    try {
      await repo.saveBodyMetric(metric, removeIds);
      showToast(editing ? '已更新紀錄' : '已儲存紀錄');
      onClose();
    } catch (err) {
      showToast(errorMessage(err));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirmDialog({ title: '刪除這筆體態紀錄？', confirmText: '刪除', danger: true });
    if (!ok) return;
    try {
      await repo.deleteBodyMetric(editing.id);
      showToast('已刪除紀錄');
      onClose();
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label="體態紀錄">
      <header class="sheet-header">
        <button type="button" class="btn-text" onClick={onClose}>
          取消
        </button>
        <h2>{editing ? '修改紀錄' : '記錄體態'}</h2>
        <button type="button" class="btn-text sheet-save" disabled={saving} onClick={save}>
          儲存
        </button>
      </header>

      <div class="sheet-form">
        <label class="field-inline">
          <span>日期</span>
          <input
            type="date"
            class="input input-date"
            value={date}
            max={todayString()}
            onInput={(e) => changeDate(e.currentTarget.value)}
          />
        </label>

        <p class="muted body-hint">每一項都可以留白，只填今天有量的就好。</p>

        <div class="metric-grid">
          {STORED_METRICS.map((def) => (
            <label key={def.key} class="big-field">
              <span class="field-label">{def.label}</span>
              <span class="big-input-wrap">
                <input
                  class="big-input big-input-md num"
                  inputMode="decimal"
                  placeholder="–"
                  value={fields[def.key]}
                  onInput={(e) => {
                    const v = sanitizeDecimalInput(e.currentTarget.value);
                    setFields((f) => ({ ...f, [def.key]: v }));
                  }}
                />
                <span class="big-input-unit">{def.unit}</span>
              </span>
            </label>
          ))}
        </div>

        <button type="button" class="btn btn-primary btn-block" disabled={saving} onClick={save}>
          儲存
        </button>
        {editing && (
          <button type="button" class="btn btn-danger-text btn-block" onClick={remove}>
            刪除這筆紀錄
          </button>
        )}
      </div>
    </div>
  );
}
