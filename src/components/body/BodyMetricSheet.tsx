import { useEffect, useRef, useState } from 'preact/hooks';
import { deleteWithUndo } from '../../actions/undo';
import { confirmDialog } from '../Dialog';
import { showToast } from '../Toast';
import { useRepository } from '../../hooks/useRepository';
import { STORED_METRICS, type StoredMetricKey } from '../../lib/bodyMetrics';
import { todayString } from '../../lib/date';
import { errorMessage } from '../../lib/errors';
import { createId } from '../../lib/id';
import { formatNumber, parseNumber, sanitizeDecimalInput } from '../../lib/number';
import { compressImage } from '../../lib/photos';
import { deletePhoto, savePhoto } from '../../data/photoStore';
import { BODY_POSES, BODY_POSE_LABELS, type BodyMetric, type BodyPhoto, type BodyPose } from '../../types/models';
import { useObjectUrl, useStoredPhoto } from '../diet/PhotoThumb';

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

/** 每個角度的照片：已存的（photoId）或剛拍、還沒存的（blob）；null 代表沒有 */
type PhotoState = Record<BodyPose, { photoId?: string; blob?: Blob } | null>;

const toPhotoState = (m: BodyMetric | undefined): PhotoState => {
  const state: PhotoState = { front: null, side: null, back: null };
  for (const p of m?.photos ?? []) state[p.pose] = { photoId: p.photoId };
  return state;
};

/** 刪掉不再使用的照片（失敗也沒關係，只是佔一點空間） */
const dropPhotos = (ids: string[]) => ids.forEach((id) => void deletePhoto(id).catch(() => undefined));

/** 一個角度的照片格子 */
function PhotoSlot(props: {
  pose: BodyPose;
  value: PhotoState[BodyPose];
  busy: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  const stored = useStoredPhoto(props.value?.blob ? undefined : props.value?.photoId);
  const url = useObjectUrl(props.value?.blob ?? stored);
  const label = BODY_POSE_LABELS[props.pose];
  return (
    <div class="pose-slot">
      {url ? (
        <img src={url} alt={`${label}體態照片`} class="pose-img" />
      ) : (
        <button type="button" class="pose-empty" disabled={props.busy} onClick={props.onPick} aria-label={`拍${label}照片`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </button>
      )}
      <span class="pose-label">{label}</span>
      {props.value && (
        <span class="pose-actions">
          <button type="button" class="btn-text" onClick={props.onPick}>
            換
          </button>
          <button type="button" class="btn-text btn-danger-text" onClick={props.onRemove}>
            移除
          </button>
        </span>
      )}
    </div>
  );
}

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
  const [photos, setPhotos] = useState<PhotoState>(() => toPhotoState(initial ?? repo.getBodyMetricByDate(todayString())));
  /** 正在選哪個角度的照片 */
  const pickingRef = useRef<BodyPose>('front');
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const pickPhoto = (pose: BodyPose) => {
    pickingRef.current = pose;
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    try {
      const blob = await compressImage(file);
      const pose = pickingRef.current;
      setPhotos((p) => ({ ...p, [pose]: { blob } }));
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

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
      setPhotos(toPhotoState(existing));
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
    const photoCount = BODY_POSES.filter((pose) => photos[pose]).length;
    if (count === 0 && photoCount === 0) return showToast('至少要填一個項目或拍一張照片');

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
    // 先存新照片，紀錄存成功後再刪掉被換掉的舊照片；紀錄存失敗就把剛存的照片刪掉
    const newIds: string[] = [];
    try {
      const list: BodyPhoto[] = [];
      for (const pose of BODY_POSES) {
        const p = photos[pose];
        if (!p) continue;
        const photoId = p.blob ? await savePhoto(p.blob) : p.photoId!;
        if (p.blob) newIds.push(photoId);
        list.push({ pose, photoId });
      }
      if (list.length > 0) metric.photos = list;
      await repo.saveBodyMetric(metric, removeIds);
    } catch (err) {
      dropPhotos(newIds);
      showToast(errorMessage(err));
      setSaving(false);
      return;
    }
    const kept = new Set((metric.photos ?? []).map((p) => p.photoId));
    const old = [editing, ...removeIds.map((id) => (id === clash?.id ? clash : undefined))]
      .flatMap((m) => m?.photos ?? [])
      .map((p) => p.photoId)
      .filter((id) => !kept.has(id));
    dropPhotos(old);
    showToast(editing ? '已更新紀錄' : '已儲存紀錄');
    onClose();
  };

  const remove = async () => {
    if (!editing) return;
    const metric = editing;
    const ok = await deleteWithUndo({
      message: '已刪除體態紀錄',
      remove: () => repo.deleteBodyMetric(metric.id),
      restore: () => repo.saveBodyMetric(metric),
      // 照片等到確定不復原才刪
      afterExpire: () => dropPhotos((metric.photos ?? []).map((p) => p.photoId)),
    });
    if (ok) onClose();
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

        <div class="field">
          <span class="field-label">體態照片（選填）</span>
          <div class="pose-grid">
            {BODY_POSES.map((pose) => (
              <PhotoSlot
                key={pose}
                pose={pose}
                value={photos[pose]}
                busy={processing}
                onPick={() => pickPhoto(pose)}
                onRemove={() => setPhotos((p) => ({ ...p, [pose]: null }))}
              />
            ))}
          </div>
          <p class="muted small-text">
            {processing ? '處理照片中…' : '每次在同樣的地點、光線、姿勢拍，前後比較才準。照片只存在這支手機，不在雲端備份裡。'}
          </p>
          {/* 不加 capture：手機會讓使用者選「拍照」或「從相簿選」 */}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.currentTarget.files?.[0])} />
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
