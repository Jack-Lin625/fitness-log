import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useRepository } from '../hooks/useRepository';
import { errorMessage } from '../lib/errors';
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart, type Exercise } from '../types/models';
import { showToast } from './Toast';

type Filter = 'recent' | BodyPart;

interface Props {
  /** 這次訓練已經加入的動作，清單中會標示 */
  usedIds: string[];
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}

/** 全螢幕的動作選擇器：依部位分類、搜尋、新增自訂動作 */
export function ExercisePicker({ usedIds, onPick, onClose }: Props) {
  const repo = useRepository();
  const recentIds = repo.getRecentExerciseIds(12);
  const [filter, setFilter] = useState<Filter>(recentIds.length > 0 ? 'recent' : 'chest');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 開啟時鎖住背景捲動
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const exercises = useMemo((): Exercise[] => {
    const all = repo.getExercises();
    const q = query.trim();
    if (q) return all.filter((e) => e.name.includes(q));
    if (filter === 'recent') {
      return recentIds
        .map((id) => repo.getExercise(id))
        .filter((e): e is Exercise => e !== undefined && !e.archived);
    }
    return all.filter((e) => e.bodyPart === filter);
  }, [repo, filter, query, recentIds.join()]);

  const chips: { value: Filter; label: string }[] = [
    ...(recentIds.length > 0 ? [{ value: 'recent' as const, label: '最近' }] : []),
    ...BODY_PARTS.map((p) => ({ value: p, label: BODY_PART_LABELS[p] })),
  ];

  const selectFilter = (value: Filter) => {
    setFilter(value);
    setQuery('');
    listRef.current?.scrollTo(0, 0);
  };

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label="選擇動作">
      <header class="sheet-header">
        <button type="button" class="btn-text" onClick={onClose}>
          取消
        </button>
        <h2>選擇動作</h2>
        <span class="sheet-header-spacer" />
      </header>

      {creating ? (
        <CustomExerciseForm
          defaultPart={filter === 'recent' ? 'chest' : filter}
          initialName={query.trim()}
          onCancel={() => setCreating(false)}
          onCreated={onPick}
        />
      ) : (
        <>
          <div class="sheet-tools">
            <input
              type="search"
              class="input"
              placeholder="搜尋動作名稱"
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
            <div class="chips" role="tablist" aria-label="部位">
              {chips.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="tab"
                  aria-selected={!query && filter === c.value}
                  class={!query && filter === c.value ? 'chip is-active' : 'chip'}
                  onClick={() => selectFilter(c.value)}
                >
                  {c.value !== 'recent' && <span class={`part-dot part-${c.value}`} aria-hidden="true" />}
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div class="sheet-list" ref={listRef}>
            {exercises.length === 0 && <p class="sheet-empty">找不到「{query}」，可以新增成自訂動作。</p>}
            {exercises.map((e) => (
              <button key={e.id} type="button" class="pick-row" onClick={() => onPick(e.id)}>
                <span class={`part-dot part-${e.bodyPart}`} aria-hidden="true" />
                <span class="pick-name">{e.name}</span>
                {e.isCustom && <span class="tag">自訂</span>}
                {usedIds.includes(e.id) && <span class="tag tag-accent">已加入</span>}
              </button>
            ))}
            <button type="button" class="pick-row pick-add" onClick={() => setCreating(true)}>
              ＋ 新增自訂動作
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** 新增自訂動作的表單 */
function CustomExerciseForm(props: {
  defaultPart: BodyPart;
  initialName: string;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const repo = useRepository();
  const [name, setName] = useState(props.initialName);
  const [part, setPart] = useState<BodyPart>(props.defaultPart);
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return showToast('請輸入動作名稱');
    if (repo.getExercises().some((e) => e.name === trimmed)) return showToast('已經有同名的動作');
    setSaving(true);
    try {
      const created = await repo.addCustomExercise({ name: trimmed, bodyPart: part, isBodyweight });
      showToast(`已新增「${created.name}」`);
      props.onCreated(created.id);
    } catch (err) {
      showToast(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div class="sheet-form">
      <label class="field">
        <span class="field-label">動作名稱</span>
        <input
          class="input"
          value={name}
          maxLength={30}
          placeholder="例如：史密斯深蹲"
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </label>

      <div class="field">
        <span class="field-label">部位</span>
        <div class="chips chips-wrap">
          {BODY_PARTS.map((p) => (
            <button
              key={p}
              type="button"
              class={part === p ? 'chip is-active' : 'chip'}
              aria-pressed={part === p}
              onClick={() => setPart(p)}
            >
              <span class={`part-dot part-${p}`} aria-hidden="true" />
              {BODY_PART_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <label class="switch-row">
        <span>
          自體重量動作
          <small class="muted">重量欄位會變成「額外負重」</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          class="switch"
          checked={isBodyweight}
          onChange={(e) => setIsBodyweight(e.currentTarget.checked)}
        />
      </label>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onClick={props.onCancel}>
          返回清單
        </button>
        <button type="button" class="btn btn-primary" disabled={saving} onClick={save}>
          新增並加入
        </button>
      </div>
    </div>
  );
}
