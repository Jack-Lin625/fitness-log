import { useState } from 'preact/hooks';
import { useRepository } from '../../hooks/useRepository';
import { errorMessage } from '../../lib/errors';
import { formatNumber, parseNumber, sanitizeDecimalInput } from '../../lib/number';
import { ALL_PLATES, calculatePlates, COMMON_BARS } from '../../lib/plates';
import { LB_BAR, LB_PLATES, unitLabel, unitName } from '../../lib/units';
import { showToast } from '../Toast';
import { PlateDiagram, plateClass } from './PlateDiagram';

/** 磅制常見的槓：奧林匹克槓 45 lb、女子槓 35 lb、技術槓 15 lb */
const LB_BARS = [LB_BAR, 35, 15];

/** 槓片計算器：輸入目標重量，畫出每邊要掛的槓片 */
export function PlateCalculator() {
  const repo = useRepository();
  const settings = repo.getSettings();
  const unit = repo.getWeightUnit();
  const isLb = unit === 'lb';
  const u = unitLabel(unit);
  /** 一次調整：公斤 2.5（一對 1.25），磅 5（一對 2.5） */
  const step = isLb ? 5 : 2.5;
  const [target, setTarget] = useState(isLb ? '135' : '60');
  const [editingPlates, setEditingPlates] = useState(false);
  /** 磅制的槓重只在這個畫面選（設定裡存的是公斤制的槓） */
  const [lbBar, setLbBar] = useState(LB_BAR);

  const bar = isLb ? lbBar : settings.barWeight;
  const plates = isLb ? LB_PLATES : settings.availablePlates;
  const bars = isLb ? LB_BARS : COMMON_BARS;
  const t = parseNumber(target) ?? 0;
  const result = calculatePlates(t, bar, plates);

  const save = (patch: Parameters<typeof repo.updateSettings>[0]) =>
    repo.updateSettings(patch).catch((err) => showToast(errorMessage(err)));

  const nudge = (delta: number) => setTarget(formatNumber(Math.max(0, t + delta)));

  const togglePlate = (p: number) => {
    const next = plates.includes(p) ? plates.filter((x) => x !== p) : [...plates, p].sort((a, b) => b - a);
    if (next.length === 0) return showToast('至少要保留一種槓片');
    void save({ availablePlates: next });
  };

  // 每邊槓片的數量統計，例如 25 × 2
  const counts = result.perSide.reduce<Map<number, number>>(
    (m, p) => m.set(p, (m.get(p) ?? 0) + 1),
    new Map(),
  );

  return (
    <div class="tool">
      <div class="target-row">
        <button type="button" class="stepper-btn stepper-lg" aria-label={`減少 ${step} ${unitName(unit)}`} onClick={() => nudge(-step)}>
          −
        </button>
        <label class="big-field target-field">
          <span class="field-label">目標重量</span>
          <span class="big-input-wrap">
            <input
              class="big-input num"
              inputMode="decimal"
              value={target}
              onInput={(e) => setTarget(sanitizeDecimalInput(e.currentTarget.value))}
            />
            <span class="big-input-unit">{u}</span>
          </span>
        </label>
        <button type="button" class="stepper-btn stepper-lg" aria-label={`增加 ${step} ${unitName(unit)}`} onClick={() => nudge(step)}>
          ＋
        </button>
      </div>

      <div class="field">
        <span class="field-label">槓鈴重量</span>
        <div class="chips">
          {bars.map((b) => (
            <button
              key={b}
              type="button"
              class={bar === b ? 'chip is-active' : 'chip'}
              aria-pressed={bar === b}
              onClick={() => (isLb ? setLbBar(b) : save({ barWeight: b }))}
            >
              <span class="num chip-num">{b}</span>&nbsp;{u}
            </button>
          ))}
        </div>
      </div>

      <div class="plate-result">
        <PlateDiagram plates={result.perSide} unit={unit} />

        {result.belowBar ? (
          <p class="plate-summary">目標比空槓（{formatNumber(bar)} {u}）還輕。</p>
        ) : result.perSide.length === 0 ? (
          <p class="plate-summary">空槓就是 {formatNumber(bar)} {u}，不用掛槓片。</p>
        ) : (
          <>
            <p class="plate-label">每邊掛</p>
            <ul class="plate-list">
              {[...counts].map(([p, n]) => (
                <li key={p}>
                  <span class={`plate-chip ${plateClass(p, unit)}`} aria-hidden="true" />
                  <span class="num plate-kg">{formatNumber(p)}</span>
                  <span class="muted">{u}</span>
                  {n > 1 && <span class="num plate-count">× {n}</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        {!result.belowBar && result.remainder > 0.001 && (
          <p class="note note-warn">
            用現有的槓片湊不到剛好 {formatNumber(t)} {u}，最接近的是 {formatNumber(result.total)} {u}。
          </p>
        )}
      </div>

      {isLb ? (
        <p class="note">磅制槓片：{LB_PLATES.join('、')} lb。要改用公斤，請到「設定」切換重量單位。</p>
      ) : (
        <section class="section">
          <button type="button" class="btn-text" aria-expanded={editingPlates} onClick={() => setEditingPlates(!editingPlates)}>
            {editingPlates ? '完成' : '健身房有哪些槓片？'}
          </button>
          {editingPlates && (
            <div class="chips chips-wrap">
              {ALL_PLATES.map((p) => {
                const on = plates.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    class={on ? 'chip is-active' : 'chip'}
                    aria-pressed={on}
                    onClick={() => togglePlate(p)}
                  >
                    <span class={`plate-chip ${plateClass(p)}`} aria-hidden="true" />
                    <span class="num chip-num">{formatNumber(p)}</span>&nbsp;kg
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
