import { useEffect, useRef, useState } from 'preact/hooks';
import { deletePhoto, savePhoto } from '../../data/photoStore';
import { useRepository } from '../../hooks/useRepository';
import { errorMessage } from '../../lib/errors';
import { createId } from '../../lib/id';
import { mealForHour } from '../../lib/nutrition';
import { formatNumber, parseNumber, sanitizeDecimalInput } from '../../lib/number';
import { compressImage } from '../../lib/photos';
import { MEAL_LABELS, MEAL_TYPES, type FoodEntry, type FoodFavorite, type MealType } from '../../types/models';
import { confirmDialog } from '../Dialog';
import { showToast } from '../Toast';
import { useObjectUrl, useStoredPhoto } from './PhotoThumb';

const MACROS = [
  { key: 'protein', label: '蛋白質' },
  { key: 'carbs', label: '碳水' },
  { key: 'fat', label: '脂肪' },
] as const;
type MacroKey = (typeof MACROS)[number]['key'];

const MAX_KCAL = 5000;

interface Props {
  /** 要修改的紀錄；沒有則為新增 */
  initial: FoodEntry | undefined;
  /** 新增時記在哪一天 */
  date: string;
  onClose: () => void;
}

const fieldOf = (v: number | undefined) => (v === undefined ? '' : formatNumber(v));

/** 新增／修改一筆飲食紀錄：照片、餐別、名稱、熱量、三大營養素 */
export function FoodEntrySheet({ initial, date, onClose }: Props) {
  const repo = useRepository();
  const fileRef = useRef<HTMLInputElement>(null);
  const [meal, setMeal] = useState<MealType>(initial?.meal ?? mealForHour(new Date().getHours()));
  const [name, setName] = useState(initial?.name ?? '');
  const [kcal, setKcal] = useState(fieldOf(initial?.kcal));
  const [macros, setMacros] = useState<Record<MacroKey, string>>({
    protein: fieldOf(initial?.protein),
    carbs: fieldOf(initial?.carbs),
    fat: fieldOf(initial?.fat),
  });
  /** 新拍的照片（尚未存檔） */
  const [newPhoto, setNewPhoto] = useState<Blob | null>(null);
  /** 使用者按了「移除照片」 */
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [busy, setBusy] = useState<'photo' | 'saving' | null>(null);

  const storedPhoto = useStoredPhoto(photoRemoved ? undefined : initial?.photoId);
  const previewUrl = useObjectUrl(newPhoto ?? storedPhoto);
  const favorites = repo.getFoodFavorites();
  const favoriteNames = new Set(favorites.map((f) => f.name));
  // 最近吃過的清單不重複列出已經在常吃裡的
  const recent = initial ? [] : repo.getRecentFoods(8).filter((f) => !favoriteNames.has(f.name));
  const currentFavorite = repo.getFoodFavoriteByName(name.trim());

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('photo');
    try {
      setNewPhoto(await compressImage(file));
      setPhotoRemoved(false);
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = ''; // 同一張照片可以再選一次
    }
  };

  const removePhoto = () => {
    setNewPhoto(null);
    setPhotoRemoved(true);
  };

  /** 一鍵帶入最近吃過或常吃的食物 */
  const fillFrom = (f: FoodEntry | FoodFavorite) => {
    setName(f.name);
    setKcal(formatNumber(f.kcal));
    setMacros({ protein: fieldOf(f.protein), carbs: fieldOf(f.carbs), fat: fieldOf(f.fat) });
  };

  /** 加入／移出常吃的食物（以名稱辨識） */
  const toggleFavorite = async () => {
    try {
      if (currentFavorite) {
        await repo.deleteFoodFavorite(currentFavorite.id);
        return showToast(`已從常吃的食物移除「${currentFavorite.name}」`);
      }
      const n = name.trim();
      const k = parseNumber(kcal);
      if (!n) return showToast('先填名稱，才能加入常吃的食物');
      if (k === null || k < 0 || k > MAX_KCAL) return showToast(`熱量請輸入 0–${MAX_KCAL} kcal`);
      const fav: FoodFavorite = { id: createId(), name: n, kcal: k };
      for (const { key } of MACROS) {
        const g = parseNumber(macros[key]);
        if (g !== null && g >= 0 && g <= 1000) fav[key] = g;
      }
      await repo.saveFoodFavorite(fav);
      showToast(`已加入常吃的食物：${n}`);
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  const save = async () => {
    const k = parseNumber(kcal);
    if (k === null || k < 0 || k > MAX_KCAL) return showToast(`熱量請輸入 0–${MAX_KCAL} kcal`);
    const entry: FoodEntry = {
      id: initial?.id ?? createId(),
      date: initial?.date ?? date,
      meal,
      // 只拍照沒寫名稱時，用餐別當名稱
      name: name.trim() || MEAL_LABELS[meal],
      kcal: k,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    for (const { key, label } of MACROS) {
      if (macros[key].trim() === '') continue;
      const g = parseNumber(macros[key]);
      if (g === null || g < 0 || g > 1000) return showToast(`${label}請輸入 0–1000 g`);
      entry[key] = g;
    }

    setBusy('saving');
    const oldPhotoId = initial?.photoId;
    let newPhotoId: string | undefined;
    try {
      if (newPhoto) newPhotoId = await savePhoto(newPhoto);
      const photoId = newPhotoId ?? (photoRemoved ? undefined : oldPhotoId);
      if (photoId) entry.photoId = photoId;
      await repo.saveFoodEntry(entry);
    } catch (err) {
      // 紀錄沒存成功，剛存的照片也刪掉，避免留下沒人用的照片
      if (newPhotoId) void deletePhoto(newPhotoId).catch(() => undefined);
      showToast(errorMessage(err));
      setBusy(null);
      return;
    }
    // 照片被換掉或移除：刪掉舊照片
    if (oldPhotoId && oldPhotoId !== entry.photoId) void deletePhoto(oldPhotoId).catch(() => undefined);
    showToast(initial ? '已更新紀錄' : `已記錄 ${entry.name} ${formatNumber(entry.kcal)} kcal`);
    onClose();
  };

  const remove = async () => {
    if (!initial) return;
    const ok = await confirmDialog({ title: `刪除「${initial.name}」？`, confirmText: '刪除', danger: true });
    if (!ok) return;
    try {
      await repo.deleteFoodEntry(initial.id);
      if (initial.photoId) void deletePhoto(initial.photoId).catch(() => undefined);
      showToast('已刪除紀錄');
      onClose();
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label="飲食紀錄">
      <header class="sheet-header">
        <button type="button" class="btn-text" onClick={onClose}>
          取消
        </button>
        <h2>{initial ? '修改紀錄' : '記錄飲食'}</h2>
        <button type="button" class="btn-text sheet-save" disabled={busy !== null} onClick={save}>
          儲存
        </button>
      </header>

      <div class="sheet-form">
        <div class="food-photo">
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="餐點照片" class="food-photo-img" />
              <div class="button-pair">
                <button type="button" class="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                  換一張
                </button>
                <button type="button" class="btn btn-danger-text btn-sm" onClick={removePhoto}>
                  移除照片
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              class="food-photo-add"
              disabled={busy === 'photo'}
              onClick={() => fileRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              <span>{busy === 'photo' ? '處理照片中…' : '拍照或選照片（選填）'}</span>
            </button>
          )}
          {/* 不加 capture：手機會讓使用者選「拍照」或「從相簿選」 */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onFile(e.currentTarget.files?.[0])}
          />
        </div>

        {!initial && favorites.length > 0 && (
          <div class="field">
            <span class="field-label">常吃的食物</span>
            <div class="chips">
              {favorites.map((f) => (
                <button key={f.id} type="button" class="chip chip-sm" onClick={() => fillFrom(f)}>
                  ★ {f.name}
                  <span class="muted">&nbsp;{formatNumber(f.kcal)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div class="field">
            <span class="field-label">最近吃過</span>
            <div class="chips">
              {recent.map((f) => (
                <button key={f.id} type="button" class="chip chip-sm" onClick={() => fillFrom(f)}>
                  {f.name}
                  <span class="muted">&nbsp;{formatNumber(f.kcal)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div class="field">
          <span class="field-label">餐別</span>
          <div class="chips">
            {MEAL_TYPES.map((m) => (
              <button
                key={m}
                type="button"
                class={meal === m ? 'chip is-active' : 'chip'}
                aria-pressed={meal === m}
                onClick={() => setMeal(m)}
              >
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="food-name">
            名稱
          </label>
          <div class="input-with-action">
            <input
              id="food-name"
              class="input"
              value={name}
              maxLength={40}
              placeholder={`例如：雞胸便當（沒填就叫「${MEAL_LABELS[meal]}」）`}
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <button
              type="button"
              class={currentFavorite ? 'fav-btn is-active' : 'fav-btn'}
              aria-pressed={Boolean(currentFavorite)}
              aria-label={currentFavorite ? '從常吃的食物移除' : '加入常吃的食物'}
              onClick={() => void toggleFavorite()}
            >
              {currentFavorite ? '★' : '☆'}
              <span>常吃</span>
            </button>
          </div>
        </div>

        <label class="big-field">
          <span class="field-label">熱量</span>
          <span class="big-input-wrap">
            <input
              class="big-input num"
              inputMode="decimal"
              placeholder="0"
              value={kcal}
              onInput={(e) => setKcal(sanitizeDecimalInput(e.currentTarget.value))}
            />
            <span class="big-input-unit">kcal</span>
          </span>
        </label>

        <div class="field">
          <span class="field-label">三大營養素（選填，公克）</span>
          <div class="metric-grid metric-grid-3">
            {MACROS.map(({ key, label }) => (
              <label key={key} class="big-field">
                <span class="muted small-text">{label}</span>
                <input
                  class="big-input big-input-sm num"
                  inputMode="decimal"
                  placeholder="–"
                  value={macros[key]}
                  onInput={(e) => {
                    const v = sanitizeDecimalInput(e.currentTarget.value);
                    setMacros((m) => ({ ...m, [key]: v }));
                  }}
                />
              </label>
            ))}
          </div>
          <p class="muted small-text">可以看包裝上的營養標示；外食不知道的話只填熱量就好。</p>
        </div>

        <button type="button" class="btn btn-primary btn-block" disabled={busy !== null} onClick={save}>
          {busy === 'saving' ? '儲存中…' : '儲存'}
        </button>
        {initial && (
          <button type="button" class="btn btn-danger-text btn-block" onClick={remove}>
            刪除這筆紀錄
          </button>
        )}
      </div>
    </div>
  );
}
