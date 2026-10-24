import { useEffect } from 'preact/hooks';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../data/catalog';
import { GUIDES } from '../data/exerciseGuides';
import { DEMOS } from '../demos';
import type { Exercise } from '../types/models';
import { EquipmentIcon } from './EquipmentIcon';
import { ExerciseCoach } from './ExerciseCoach';
import { Mannequin } from './Mannequin';

/** 動作教學（全螢幕）：假人示範 + 準備、步驟、重點、常見錯誤、呼吸、安全，最下面可以問 AI 教練 */
export function ExerciseGuideSheet({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const guide = GUIDES[exercise.id];
  const demo = DEMOS[exercise.id];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label={`${exercise.name}動作教學`}>
      <header class="sheet-header">
        <button type="button" class="btn-text" onClick={onClose}>
          關閉
        </button>
        <h2>{exercise.name}</h2>
        <span class="sheet-header-spacer" />
      </header>

      <div class="sheet-list guide-body">
        <div class="guide-meta">
          <span class="eq-tile" style={{ width: '44px', height: '44px' }}>
            <EquipmentIcon equipment={exercise.equipment} size={36} />
          </span>
          <div>
            <p>{EQUIPMENT_LABELS[exercise.equipment]}</p>
            <p class="muted">
              主要：{exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join('、')}
              {exercise.secondaryMuscles.length > 0 &&
                `｜輔助：${exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join('、')}`}
            </p>
          </div>
        </div>

        {demo && <Mannequin demo={demo} label={exercise.name} />}

        {guide ? (
          <>
            <section class="guide-section">
              <h3>準備姿勢</h3>
              <ul class="guide-list">
                {guide.setup.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>

            <section class="guide-section">
              <h3>動作步驟</h3>
              <ol class="stretch-steps">
                {guide.steps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </section>

            <section class="guide-section">
              <h3>重點</h3>
              <ul class="stretch-cues">
                {guide.cues.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>

            <section class="guide-section">
              <h3 class="guide-mistake-title">常見錯誤</h3>
              <ul class="mistake-list">
                {guide.mistakes.map((m) => (
                  <li key={m.what}>
                    <p class="mistake-what">✕ {m.what}</p>
                    <p class="mistake-fix">→ {m.fix}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section class="guide-section">
              <h3>呼吸</h3>
              <p>{guide.breathing}</p>
            </section>

            <section class="guide-section guide-safety">
              <h3>安全提醒</h3>
              <ul class="guide-list">
                {guide.safety.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <p class="note">這個動作的教學內容還在製作中。</p>
        )}

        <ExerciseCoach exercise={exercise} guide={guide} onClose={onClose} />

        <p class="note">
          動畫是簡化比例的示意圖，用來理解動作軌跡和身體角度。第一次做重量訓練，建議請教練或有經驗的人實際看過你的動作。
        </p>
      </div>
    </div>
  );
}
