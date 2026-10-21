import { useState } from 'preact/hooks';
import { formatNumber, parseNumber, sanitizeDecimalInput, sanitizeIntInput } from '../../lib/number';
import {
  averageOneRepMax,
  brzycki,
  epley,
  MAX_REPS,
  PERCENTAGES,
  RELIABLE_MAX_REPS,
  roundTo,
} from '../../lib/oneRepMax';

/** 1RM 估算：輸入重量與次數，同時顯示 Epley 與 Brzycki */
export function OneRepMaxTool() {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const w = parseNumber(weight) ?? 0;
  const r = Math.min(parseNumber(reps) ?? 0, MAX_REPS);
  const ready = w > 0 && r > 0;
  const avg = ready ? averageOneRepMax(w, r) : 0;

  return (
    <div class="tool">
      <div class="tool-inputs">
        <label class="big-field">
          <span class="field-label">重量</span>
          <span class="big-input-wrap">
            <input
              class="big-input num"
              inputMode="decimal"
              placeholder="0"
              value={weight}
              onInput={(e) => setWeight(sanitizeDecimalInput(e.currentTarget.value))}
            />
            <span class="big-input-unit">kg</span>
          </span>
        </label>
        <span class="tool-times" aria-hidden="true">
          ×
        </span>
        <label class="big-field">
          <span class="field-label">次數</span>
          <span class="big-input-wrap">
            <input
              class="big-input num"
              inputMode="numeric"
              placeholder="0"
              value={reps}
              onInput={(e) => setReps(sanitizeIntInput(e.currentTarget.value).slice(0, 2))}
            />
            <span class="big-input-unit">下</span>
          </span>
        </label>
      </div>

      <div class="stat-row">
        <div class="big-stat">
          <div class="big-stat-value">
            <span class="num">{ready ? formatNumber(Math.round(epley(w, r) * 10) / 10) : '–'}</span>
            <span class="big-stat-unit">kg</span>
          </div>
          <div class="big-stat-label">Epley 公式</div>
        </div>
        <div class="big-stat">
          <div class="big-stat-value">
            <span class="num">{ready ? formatNumber(Math.round(brzycki(w, r) * 10) / 10) : '–'}</span>
            <span class="big-stat-unit">kg</span>
          </div>
          <div class="big-stat-label">Brzycki 公式</div>
        </div>
      </div>

      {ready && r > RELIABLE_MAX_REPS && (
        <p class="note note-warn">超過 {RELIABLE_MAX_REPS} 下時，兩個公式的誤差都會明顯變大，結果僅供參考。</p>
      )}

      <p class="note">
        {'這是根據你做到的次數推算的估計值，不是實測結果。不建議在沒有保護者的情況下直接挑戰最大重量；想測真正的 1RM，請循序加重，並找有經驗的人協助保護。'}
      </p>

      {ready && (
        <section class="section">
          <h2 class="section-title">訓練強度對照（以兩公式平均，取整到 2.5 kg）</h2>
          <table class="pct-table">
            <tbody>
              {PERCENTAGES.map((p) => (
                <tr key={p}>
                  <th scope="row" class="num">
                    {p}%
                  </th>
                  <td>
                    <span class="num">{formatNumber(roundTo((avg * p) / 100))}</span> kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <details class="formula">
        <summary>公式說明</summary>
        <p>Epley：重量 × (1 + 次數 ÷ 30)</p>
        <p>Brzycki：重量 × 36 ÷ (37 − 次數)</p>
        <p>次數為 1 時，兩者都等於該重量。</p>
      </details>
    </div>
  );
}
