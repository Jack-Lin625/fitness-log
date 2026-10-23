import { useState } from 'preact/hooks';
import { formatDateLabel } from '../../lib/date';
import { formatNumber } from '../../lib/number';
import { BODY_POSES, BODY_POSE_LABELS, type BodyMetric, type BodyPose } from '../../types/models';
import { useObjectUrl, useStoredPhoto } from '../diet/PhotoThumb';

function ComparePhoto({ metric, pose, caption }: { metric: BodyMetric; pose: BodyPose; caption: string }) {
  const photoId = metric.photos?.find((p) => p.pose === pose)?.photoId;
  const url = useObjectUrl(useStoredPhoto(photoId));
  return (
    <figure class="compare-fig">
      {url ? (
        <img src={url} alt={`${formatDateLabel(metric.date)}的${BODY_POSE_LABELS[pose]}體態照片`} class="compare-img" />
      ) : (
        // 換手機後沒有匯入照片備份時，紀錄還在但照片不在
        <span class="compare-img compare-missing">找不到照片</span>
      )}
      <figcaption>
        <span class="compare-cap">{caption}</span>
        {formatDateLabel(metric.date)}
        {metric.weight !== undefined && (
          <span class="muted">
            {' '}
            <span class="num">{formatNumber(metric.weight)}</span> kg
          </span>
        )}
      </figcaption>
    </figure>
  );
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** 體態照片前後對比：選角度與兩個日期，並排顯示 */
export function PhotoCompare({ metrics }: { metrics: BodyMetric[] }) {
  const withPhotos = metrics.filter((m) => m.photos && m.photos.length > 0);
  const poses = BODY_POSES.filter((pose) => withPhotos.some((m) => m.photos!.some((p) => p.pose === pose)));
  const [pose, setPose] = useState<BodyPose | null>(null);
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);

  if (withPhotos.length === 0) {
    return <p class="note">記錄體態時可以拍正面、側面、背面的照片，這裡會並排比較前後的變化。</p>;
  }

  const current = pose && poses.includes(pose) ? pose : poses[0]!;
  // 這個角度有照片的紀錄（舊到新）
  const list = withPhotos.filter((m) => m.photos!.some((p) => p.pose === current));
  const after = list.find((m) => m.id === afterId) ?? list[list.length - 1]!;
  const before = list.find((m) => m.id === beforeId && m.date < after.date) ?? list[0]!;
  const sameDay = before.id === after.id;
  const weightChange = !sameDay && before.weight !== undefined && after.weight !== undefined ? after.weight - before.weight : null;

  const option = (m: BodyMetric) => (
    <option key={m.id} value={m.id}>
      {formatDateLabel(m.date)}
    </option>
  );

  return (
    <div class="compare">
      {poses.length > 1 && (
        <div class="chips" role="group" aria-label="角度">
          {poses.map((p) => (
            <button key={p} type="button" class={p === current ? 'chip is-active' : 'chip'} aria-pressed={p === current} onClick={() => setPose(p)}>
              {BODY_POSE_LABELS[p]}
            </button>
          ))}
        </div>
      )}

      {sameDay ? (
        <>
          <ComparePhoto metric={after} pose={current} caption="目前" />
          <p class="note">再拍一次{BODY_POSE_LABELS[current]}照片，就能和這次並排比較。</p>
        </>
      ) : (
        <>
          <div class="compare-pair">
            <ComparePhoto metric={before} pose={current} caption="之前" />
            <ComparePhoto metric={after} pose={current} caption="之後" />
          </div>
          <p class="compare-summary">
            相隔 <span class="num">{daysBetween(before.date, after.date)}</span> 天
            {weightChange !== null && (
              <>
                ，體重 <span class="num">{weightChange > 0 ? '+' : weightChange < 0 ? '−' : '±'}{formatNumber(Math.abs(Math.round(weightChange * 10) / 10))}</span> kg
              </>
            )}
          </p>
          {list.length > 2 && (
            <div class="compare-pick">
              <label class="field">
                <span class="field-label">之前</span>
                <select class="input select select-sm" value={before.id} onChange={(e) => setBeforeId(e.currentTarget.value)}>
                  {list.filter((m) => m.date < after.date).map(option)}
                </select>
              </label>
              <label class="field">
                <span class="field-label">之後</span>
                <select class="input select select-sm" value={after.id} onChange={(e) => setAfterId(e.currentTarget.value)}>
                  {list.filter((m) => m.date > list[0]!.date).map(option)}
                </select>
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}
