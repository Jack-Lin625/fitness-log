import { useEffect, useState } from 'preact/hooks';
import type { Exercise } from '../types/models';
import type { ExerciseGuideSheet } from './ExerciseGuideSheet';
import { showToast } from './Toast';

type SheetComponent = typeof ExerciseGuideSheet;

/** 教學頁的程式（138 個動作的教學與假人動畫）只在第一次打開時下載，下載過就留著 */
let loaded: SheetComponent | null = null;

export function loadGuideSheet(): Promise<SheetComponent> {
  return import('./ExerciseGuideSheet').then((m) => (loaded = m.ExerciseGuideSheet));
}

/** 動作教學（需要時才載入） */
export function LazyGuideSheet(props: { exercise: Exercise; onClose: () => void }) {
  const [Sheet, setSheet] = useState<SheetComponent | null>(() => loaded);

  useEffect(() => {
    if (Sheet) return;
    loadGuideSheet()
      .then((c) => setSheet(() => c))
      .catch(() => {
        showToast('教學載入失敗，請確認網路後再試');
        props.onClose();
      });
  }, []);

  if (Sheet) return <Sheet {...props} />;
  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label={`${props.exercise.name}動作教學`} aria-busy="true">
      <header class="sheet-header">
        <button type="button" class="btn-text" onClick={props.onClose}>
          關閉
        </button>
        <h2>{props.exercise.name}</h2>
        <span class="sheet-header-spacer" />
      </header>
      <p class="muted sheet-loading">載入教學中…</p>
    </div>
  );
}
