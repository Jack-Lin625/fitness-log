import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  EQUIPMENT_GROUPS,
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  type EquipmentGroup,
} from '../data/catalog';
import { useRepository } from '../hooks/useRepository';
import { errorMessage } from '../lib/errors';
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart, type Equipment, type Exercise } from '../types/models';
import { EquipmentIcon } from './EquipmentIcon';
import { showToast } from './Toast';

type PartFilter = 'recent' | 'all' | BodyPart;
type GearFilter = 'all' | EquipmentGroup;

interface Props {
  /** 這次訓練已經加入的動作，清單中會標示 */
  usedIds: string[];
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}

/** 動作名稱、器材、肌群都可以搜尋 */
function matches(e: Exercise, q: string): boolean {
  if (e.name.includes(q) || EQUIPMENT_LABELS[e.equipment].includes(q)) return true;
  return [...e.primaryMuscles, ...e.secondaryMuscles].some((m) => MUSCLE_LABELS[m].includes(q));
}

/** 全螢幕的動作選擇器：依部位與器材分類、搜尋、新增自訂動作 */
export function ExercisePicker({ usedIds, onPick, onClose }: Props) {
  const repo = useRepository();
  const recentIds = repo.getRecentExerciseIds(12);
  const [part, setPart] = useState<PartFilter>(recentIds.length > 0 ? 'recent' : 'chest');
  const [gear, setGear] = useState<GearFilter>('all');
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
    let list: Exercise[];
    if (q) list = all.filter((e) => matches(e, q));
    else if (part === 'recent')
      list = recentIds.map((id) => repo.getExercise(id)).filter((e): e is Exercise => !!e && !e.archived);
    else if (part === 'all') list = all;
    else list = all.filter((e) => e.bodyPart === part);

    if (gear !== 'all') {
      const items = EQUIPMENT_GROUPS.find((g) => g.id === gear)?.items ?? [];
      list = list.filter((e) => items.includes(e.equipment));
    }
    return list;
  }, [repo, part, gear, query, recentIds.join()]);

  const partChips: { value: PartFilter; label: string }[] = [
    ...(recentIds.length > 0 ? [{ value: 'recent' as const, label: '最近' }] : []),
    ...BODY_PARTS.map((p) => ({ value: p, label: BODY_PART_LABELS[p] })),
    { value: 'all', label: '全部' },
  ];

  const selectPart = (value: PartFilter) => {
    setPart(value);
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
          defaultPart={part === 'recent' || part === 'all' ? 'chest' : part}
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
              placeholder="搜尋動作、器材或肌群"
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
            <div class="chips" role="tablist" aria-label="部位">
              {partChips.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="tab"
                  aria-selected={!query && part === c.value}
                  class={!query && part === c.value ? 'chip is-active' : 'chip'}
                  onClick={() => selectPart(c.value)}
                >
                  {c.value !== 'recent' && c.value !== 'all' && (
                    <span class={`part-dot part-${c.value}`} aria-hidden="true" />
                  )}
                  {c.label}
                </button>
              ))}
            </div>
            <div class="chips chips-sm" role="group" aria-label="器材">
              {[{ id: 'all' as const, label: '全部器材' }, ...EQUIPMENT_GROUPS].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  class={gear === g.id ? 'chip chip-sm is-active-soft' : 'chip chip-sm'}
                  aria-pressed={gear === g.id}
                  onClick={() => setGear(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div class="sheet-list" ref={listRef}>
            {exercises.length === 0 && (
              <p class="sheet-empty">{query ? `找不到「${query}」，可以新增成自訂動作。` : '這個分類沒有符合的動作。'}</p>
            )}
            {exercises.map((e) => (
              <button key={e.id} type="button" class="pick-row" onClick={() => onPick(e.id)}>
                <span class="eq-tile" style={{ width: '52px', height: '52px' }}>
                  <EquipmentIcon equipment={e.equipment} size={42} />
                </span>
                <span class="pick-main">
                  <span class="pick-name">
                    <span class={`part-dot part-${e.bodyPart}`} aria-hidden="true" />
                    {e.name}
                  </span>
                  <span class="pick-meta">
                    {EQUIPMENT_LABELS[e.equipment]}｜{e.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join('、')}
                  </span>
                </span>
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
  const [equipment, setEquipment] = useState<Equipment>('other');
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return showToast('請輸入動作名稱');
    if (repo.getExercises().some((e) => e.name === trimmed)) return showToast('已經有同名的動作');
    setSaving(true);
    try {
      const created = await repo.addCustomExercise({ name: trimmed, bodyPart: part, isBodyweight, equipment });
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
          placeholder="例如：單腳腿推"
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

      <div class="field">
        <span class="field-label">器材：{EQUIPMENT_LABELS[equipment]}</span>
        {EQUIPMENT_GROUPS.map((g) => (
          <div key={g.id} class="eq-group">
            <span class="eq-group-label">{g.label}</span>
            <div class="eq-grid" role="radiogroup" aria-label={g.label}>
              {g.items.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={equipment === id}
                  class={equipment === id ? 'eq-option is-active' : 'eq-option'}
                  onClick={() => setEquipment(id)}
                >
                  <EquipmentIcon equipment={id} size={40} />
                  <span>{EQUIPMENT_LABELS[id]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
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
