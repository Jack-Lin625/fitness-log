import { useEffect, useState } from 'preact/hooks';
import { showToast } from '../Toast';
import { useRepository } from '../../hooks/useRepository';
import { errorMessage } from '../../lib/errors';
import { DEFAULT_SET_TARGETS, MAX_WEEKLY_SETS, targetStatus, targetText, type SetTarget } from '../../lib/setTargets';
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart } from '../../types/models';

/** 各部位本週組數與目標範圍：長條圖上的淺色區塊就是目標範圍 */
export function SetTargetList({ sets, targets }: { sets: Record<BodyPart, number>; targets: Record<BodyPart, SetTarget> }) {
  // 所有部位共用同一個比例尺，長度才能互相比較
  const scale = Math.max(...BODY_PARTS.map((p) => Math.max(sets[p], targets[p].max)), 1) * 1.08;
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <ul class="target-list">
      {BODY_PARTS.map((part) => {
        const t = targets[part];
        const n = sets[part];
        const status = targetStatus(n, t);
        return (
          <li key={part} class={`target-row is-${status}`}>
            <span class="target-name">
              <span class={`part-dot part-${part}`} aria-hidden="true" />
              {BODY_PART_LABELS[part]}
            </span>
            <span class="target-count">
              <span class="num">{n}</span>
              <span class="muted">{status === 'none' ? ' 組' : ` / ${t.min}–${t.max}`}</span>
            </span>
            <span class="target-bar" aria-hidden="true">
              {status !== 'none' && <span class="target-zone" style={{ left: pct(t.min), width: `calc(${pct(t.max)} - ${pct(t.min)})` }} />}
              {n > 0 && <span class={`target-fill part-${part}`} style={{ width: pct(n) }} />}
            </span>
            <span class="target-status">{targetText(n, t)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** 一個數字的加減按鈕 */
function Stepper(props: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div class="stepper" role="group" aria-label={props.label}>
      <button type="button" class="stepper-btn" aria-label={`${props.label}減 1`} disabled={props.value <= props.min} onClick={() => props.onChange(props.value - 1)}>
        −
      </button>
      <span class="num stepper-value">{props.value}</span>
      <button type="button" class="stepper-btn" aria-label={`${props.label}加 1`} disabled={props.value >= props.max} onClick={() => props.onChange(props.value + 1)}>
        ＋
      </button>
    </div>
  );
}

/** 調整各部位的每週組數目標 */
export function SetTargetSheet({ onClose }: { onClose: () => void }) {
  const repo = useRepository();
  const [draft, setDraft] = useState<Record<BodyPart, SetTarget>>(() => repo.getSetTargets());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const update = (part: BodyPart, patch: Partial<SetTarget>) =>
    setDraft((d) => {
      const next = { ...d[part], ...patch };
      // 下限不能超過上限：調整其中一個時，另一個跟著推
      if (patch.min !== undefined && next.max < next.min) next.max = next.min;
      if (patch.max !== undefined && next.min > next.max) next.min = next.max;
      return { ...d, [part]: next };
    });

  const save = async () => {
    setSaving(true);
    try {
      for (const part of BODY_PARTS) {
        const t = draft[part];
        const d = DEFAULT_SET_TARGETS[part];
        const off = t.min === 0;
        // 和預設一樣就不存（之後預設調整時會跟著更新）
        await repo.setSetTarget(part, !off && t.min === d.min && t.max === d.max ? null : off ? { min: 0, max: 0 } : t);
      }
      showToast('已更新組數目標');
      onClose();
    } catch (err) {
      showToast(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label="每週組數目標">
      <header class="sheet-header">
        <button type="button" class="btn-text" onClick={onClose}>
          取消
        </button>
        <h2>每週組數目標</h2>
        <button type="button" class="btn-text sheet-save" disabled={saving} onClick={save}>
          儲存
        </button>
      </header>
      <div class="sheet-form">
        <p class="muted small-text">
          一般建議每個肌群每週做 10–20 個正式組。剛開始訓練的人從下限開始；超過上限不一定更好，可能恢復不過來。手臂和核心在推、拉、深蹲時也會出力，所以預設較低。
        </p>
        {BODY_PARTS.map((part) => {
          const t = draft[part];
          const off = t.min === 0;
          return (
            <div key={part} class="target-edit">
              <div class="target-edit-head">
                <span class="target-name">
                  <span class={`part-dot part-${part}`} aria-hidden="true" />
                  {BODY_PART_LABELS[part]}
                </span>
                <label class="switch-row target-switch">
                  <span class="small-text">設目標</span>
                  <input
                    type="checkbox"
                    role="switch"
                    class="switch"
                    checked={!off}
                    onChange={(e) => update(part, e.currentTarget.checked ? { ...DEFAULT_SET_TARGETS[part] } : { min: 0, max: 0 })}
                  />
                </label>
              </div>
              {!off && (
                <div class="target-edit-range">
                  <span class="muted small-text">下限</span>
                  <Stepper label={`${BODY_PART_LABELS[part]}下限`} value={t.min} min={1} max={MAX_WEEKLY_SETS} onChange={(v) => update(part, { min: v })} />
                  <span class="muted small-text">上限</span>
                  <Stepper label={`${BODY_PART_LABELS[part]}上限`} value={t.max} min={1} max={MAX_WEEKLY_SETS} onChange={(v) => update(part, { max: v })} />
                </div>
              )}
            </div>
          );
        })}
        <button type="button" class="btn btn-ghost btn-block" onClick={() => setDraft({ ...DEFAULT_SET_TARGETS })}>
          全部恢復預設
        </button>
        <button type="button" class="btn btn-primary btn-block" disabled={saving} onClick={save}>
          儲存
        </button>
      </div>
    </div>
  );
}
