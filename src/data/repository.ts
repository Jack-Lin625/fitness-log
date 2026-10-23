import type {
  AppData,
  BodyMetric,
  Exercise,
  FoodEntry,
  FoodFavorite,
  NutritionProfile,
  Settings,
  WeightUnit,
  WorkoutDraft,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from '../types/models';
import { createId } from '../lib/id';
import { DEFAULT_MUSCLES } from './catalog';
import { DEFAULT_EXERCISES } from './defaultExercises';
import { createEmptyData, migrate } from './migrations';
import type { StorageAdapter } from './storageAdapter';

/** 某個動作最近一次的表現（顯示在訓練畫面的「上次」） */
export interface LastPerformance {
  date: string;
  sets: WorkoutSet[];
  /** 上次留的動作備註（座椅高度、握距等），沒有則為 undefined */
  note?: string;
}

/** 啟動時讀取資料的結果，供設定頁與錯誤提示使用 */
export type LoadStatus =
  | { ok: true; isNew: boolean }
  | { ok: false; message: string; backupKey: string | null };

/**
 * 資料存取層（Repository）
 *
 * - UI 只透過這個類別讀寫資料，不直接碰 localStorage。
 * - 啟動時 init() 以非同步方式從 adapter 載入，之後讀取走記憶體快取（同步、快速）。
 * - 所有寫入都是非同步：先寫入 adapter，成功後才更新快取並通知畫面；
 *   寫入失敗時快取維持原樣並丟出錯誤，畫面不會顯示「假的已儲存」。
 * - 快取物件視為不可變（immutable），每次寫入都產生新物件，方便 UI 判斷變化。
 */
export class Repository {
  private data: AppData = createEmptyData();
  private readonly listeners = new Set<() => void>();
  private _loadStatus: LoadStatus = { ok: true, isNew: true };

  /*
   * 衍生資料的快取。因為快取物件不可變，來源陣列換了（被寫入）才需要重算，
   * 不必在每個寫入方法裡手動清除。
   */
  private exerciseCache: { source: Exercise[]; all: Exercise[]; byId: Map<string, Exercise> } | null = null;
  private sessionCache: { source: WorkoutSession[]; sorted: WorkoutSession[] } | null = null;

  constructor(private readonly adapter: StorageAdapter) {}

  get loadStatus(): LoadStatus {
    return this._loadStatus;
  }

  /** 啟動時呼叫一次：載入、升級資料格式；失敗時備份原始資料並以空白資料啟動 */
  async init(): Promise<void> {
    try {
      const raw = await this.adapter.load();
      if (raw === null) {
        this.data = createEmptyData();
        this._loadStatus = { ok: true, isNew: true };
        return;
      }
      const before = (raw as { version?: unknown }).version;
      this.data = migrate(raw);
      // 有升級過就立刻寫回，避免每次啟動都重新升級
      if (before !== this.data.version) await this.adapter.save(this.data);
      this._loadStatus = { ok: true, isNew: false };
    } catch (err) {
      const backupKey = await this.adapter.backupRaw('load-failed');
      this.data = createEmptyData();
      this._loadStatus = {
        ok: false,
        message: err instanceof Error ? err.message : '讀取資料時發生未知錯誤',
        backupKey,
      };
    }
  }

  /** 訂閱資料變化，回傳取消訂閱函式 */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 寫入流程的唯一入口：產生新資料 → 寫入儲存 → 更新快取 → 通知 */
  private async commit(next: AppData): Promise<void> {
    await this.adapter.save(next);
    this.data = next;
    this.listeners.forEach((fn) => fn());
  }

  // ───────── 動作 ─────────

  /** 內建 + 自訂動作，以及 id 索引（畫面每次渲染會查很多次，不要每次都重建） */
  private exerciseIndex() {
    const source = this.data.customExercises;
    if (this.exerciseCache?.source !== source) {
      const all = [...DEFAULT_EXERCISES, ...source];
      this.exerciseCache = { source, all, byId: new Map(all.map((e) => [e.id, e])) };
    }
    return this.exerciseCache;
  }

  /** 所有動作（內建 + 自訂），預設排除已封存 */
  getExercises(includeArchived = false): Exercise[] {
    const { all } = this.exerciseIndex();
    return includeArchived ? [...all] : all.filter((e) => !e.archived);
  }

  /** 依 id 取得動作（包含已封存，讓舊紀錄仍能顯示名稱） */
  getExercise(id: string): Exercise | undefined {
    return this.exerciseIndex().byId.get(id);
  }

  /** 是否為輔助機器動作（重量代表輔助，不計入容量） */
  isAssisted = (id: string): boolean => this.getExercise(id)?.assisted === true;

  /** 計算 PR 需要的動作特性 */
  traitsOf = (id: string): { bodyweight: boolean; assisted: boolean } => {
    const e = this.getExercise(id);
    return { bodyweight: e?.isBodyweight ?? false, assisted: e?.assisted === true };
  };

  async addCustomExercise(
    input: Pick<Exercise, 'name' | 'bodyPart' | 'isBodyweight' | 'equipment'>,
  ): Promise<Exercise> {
    const exercise: Exercise = {
      ...input,
      id: createId(),
      isCustom: true,
      primaryMuscles: [...DEFAULT_MUSCLES[input.bodyPart]],
      secondaryMuscles: [],
    };
    await this.commit({ ...this.data, customExercises: [...this.data.customExercises, exercise] });
    return exercise;
  }

  /** 刪除自訂動作 = 封存（保留舊紀錄的對應） */
  async archiveCustomExercise(id: string): Promise<void> {
    const customExercises = this.data.customExercises.map((e) =>
      e.id === id ? { ...e, archived: true } : e,
    );
    await this.commit({ ...this.data, customExercises });
  }

  /** 取消封存（復原刪除） */
  async unarchiveCustomExercise(id: string): Promise<void> {
    const customExercises = this.data.customExercises.map((e) => {
      if (e.id !== id) return e;
      const { archived: _, ...rest } = e;
      return rest;
    });
    await this.commit({ ...this.data, customExercises });
  }

  // ───────── 訓練 ─────────

  /** 新到舊排序的訓練（內部共用，不可修改） */
  private sortedSessions(): readonly WorkoutSession[] {
    const source = this.data.sessions;
    if (this.sessionCache?.source !== source) {
      const sorted = [...source].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
      this.sessionCache = { source, sorted };
    }
    return this.sessionCache.sorted;
  }

  /** 所有訓練，新到舊排序 */
  getSessions(): WorkoutSession[] {
    return [...this.sortedSessions()];
  }

  getSession(id: string): WorkoutSession | undefined {
    return this.data.sessions.find((s) => s.id === id);
  }

  /** 新增或更新一次訓練（依 id 判斷） */
  async saveSession(session: WorkoutSession): Promise<void> {
    const updated: WorkoutSession = { ...session, updatedAt: Date.now() };
    const exists = this.data.sessions.some((s) => s.id === session.id);
    const sessions = exists
      ? this.data.sessions.map((s) => (s.id === session.id ? updated : s))
      : [...this.data.sessions, updated];
    await this.commit({ ...this.data, sessions });
  }

  async deleteSession(id: string): Promise<void> {
    await this.commit({ ...this.data, sessions: this.data.sessions.filter((s) => s.id !== id) });
  }

  /** 某動作最近一次的紀錄；editingSessionId 用來排除正在修改的那一筆 */
  getLastPerformance(exerciseId: string, excludeSessionId?: string): LastPerformance | null {
    for (const session of this.sortedSessions()) {
      if (session.id === excludeSessionId) continue;
      const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
      if (ex) {
        const last: LastPerformance = { date: session.date, sets: ex.sets };
        // 備註通常是器材設定，最近一次沒寫就往前找
        const note = ex.note ?? this.lastNote(exerciseId, excludeSessionId);
        if (note) last.note = note;
        return last;
      }
    }
    return null;
  }

  private lastNote(exerciseId: string, excludeSessionId?: string): string | undefined {
    for (const session of this.sortedSessions()) {
      if (session.id === excludeSessionId) continue;
      const note = session.exercises.find((e) => e.exerciseId === exerciseId && e.note)?.note;
      if (note) return note;
    }
    return undefined;
  }

  /** 最近用過的動作 id（新到舊、不重複） */
  getRecentExerciseIds(limit: number): string[] {
    const seen = new Set<string>();
    for (const session of this.sortedSessions()) {
      for (const ex of session.exercises) {
        seen.add(ex.exerciseId);
        if (seen.size >= limit) return [...seen];
      }
    }
    return [...seen];
  }

  // ───────── 訓練草稿 ─────────

  getDraft(): WorkoutDraft | null {
    return this.data.activeDraft;
  }

  /** 只寫入草稿（訓練中頻繁暫存，不重寫全部資料） */
  async saveDraft(draft: WorkoutDraft | null): Promise<void> {
    await this.adapter.saveDraft(draft);
    this.data = { ...this.data, activeDraft: draft };
    this.listeners.forEach((fn) => fn());
  }

  async clearDraft(): Promise<void> {
    await this.saveDraft(null);
  }

  /** 完成訓練：儲存紀錄並清除草稿（同一次寫入，不會只成功一半） */
  async finishDraft(session: WorkoutSession): Promise<void> {
    const exists = this.data.sessions.some((s) => s.id === session.id);
    const sessions = exists
      ? this.data.sessions.map((s) => (s.id === session.id ? session : s))
      : [...this.data.sessions, session];
    await this.commit({ ...this.data, sessions, activeDraft: null });
  }

  // ───────── 菜單範本 ─────────

  /** 所有範本，依名稱排序 */
  getTemplates(): WorkoutTemplate[] {
    return [...this.data.templates].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  }

  getTemplate(id: string): WorkoutTemplate | undefined {
    return this.data.templates.find((t) => t.id === id);
  }

  /** 新增或更新範本（依 id 判斷） */
  async saveTemplate(template: WorkoutTemplate): Promise<void> {
    const others = this.data.templates.filter((t) => t.id !== template.id);
    await this.commit({ ...this.data, templates: [...others, template] });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.commit({ ...this.data, templates: this.data.templates.filter((t) => t.id !== id) });
  }

  // ───────── 體態 ─────────

  /** 所有體態紀錄，舊到新排序（方便畫趨勢圖） */
  getBodyMetrics(): BodyMetric[] {
    return [...this.data.bodyMetrics].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** 同一天的紀錄 */
  getBodyMetricByDate(date: string): BodyMetric | undefined {
    return this.data.bodyMetrics.find((m) => m.date === date);
  }

  /**
   * 新增或更新體態紀錄。
   * removeIds：一併刪除的紀錄（例如把日期改到已有紀錄的那天時，取代掉舊的），同一次寫入完成。
   */
  async saveBodyMetric(metric: BodyMetric, removeIds: string[] = []): Promise<void> {
    const others = this.data.bodyMetrics.filter((m) => m.id !== metric.id && !removeIds.includes(m.id));
    await this.commit({ ...this.data, bodyMetrics: [...others, metric] });
  }

  async deleteBodyMetric(id: string): Promise<void> {
    await this.commit({ ...this.data, bodyMetrics: this.data.bodyMetrics.filter((m) => m.id !== id) });
  }

  // ───────── 飲食 ─────────

  getNutritionProfile(): NutritionProfile | null {
    return this.data.nutritionProfile;
  }

  async saveNutritionProfile(profile: NutritionProfile): Promise<void> {
    await this.commit({ ...this.data, nutritionProfile: profile });
  }

  /** 某一天的飲食紀錄，依建立時間排序 */
  getFoodEntries(date: string): FoodEntry[] {
    return this.data.foodEntries.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt);
  }

  getFoodEntry(id: string): FoodEntry | undefined {
    return this.data.foodEntries.find((e) => e.id === id);
  }

  /** 每天的總熱量（只含有紀錄的日子） */
  getDailyKcal(): Map<string, number> {
    const totals = new Map<string, number>();
    for (const e of this.data.foodEntries) totals.set(e.date, (totals.get(e.date) ?? 0) + e.kcal);
    return totals;
  }

  /** 最近吃過的食物（同名只留最新一筆），用來一鍵帶入 */
  getRecentFoods(limit: number): FoodEntry[] {
    const seen = new Set<string>();
    const result: FoodEntry[] = [];
    const newest = [...this.data.foodEntries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    for (const e of newest) {
      if (seen.has(e.name)) continue;
      seen.add(e.name);
      result.push(e);
      if (result.length >= limit) break;
    }
    return result;
  }

  /** 新增或更新一筆飲食紀錄（依 id 判斷） */
  async saveFoodEntry(entry: FoodEntry): Promise<void> {
    const others = this.data.foodEntries.filter((e) => e.id !== entry.id);
    await this.commit({ ...this.data, foodEntries: [...others, entry] });
  }

  async deleteFoodEntry(id: string): Promise<void> {
    await this.commit({ ...this.data, foodEntries: this.data.foodEntries.filter((e) => e.id !== id) });
  }

  /** 常吃的食物，依名稱排序 */
  getFoodFavorites(): FoodFavorite[] {
    return [...this.data.foodFavorites].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  }

  /** 同名的常吃食物（名稱是使用者辨識的依據） */
  getFoodFavoriteByName(name: string): FoodFavorite | undefined {
    return this.data.foodFavorites.find((f) => f.name === name);
  }

  /** 新增或更新常吃的食物；同名的會被取代 */
  async saveFoodFavorite(favorite: FoodFavorite): Promise<void> {
    const others = this.data.foodFavorites.filter((f) => f.id !== favorite.id && f.name !== favorite.name);
    await this.commit({ ...this.data, foodFavorites: [...others, favorite] });
  }

  async deleteFoodFavorite(id: string): Promise<void> {
    await this.commit({ ...this.data, foodFavorites: this.data.foodFavorites.filter((f) => f.id !== id) });
  }

  // ───────── 設定 ─────────

  getSettings(): Settings {
    return this.data.settings;
  }

  /** 訓練重量的單位 */
  getWeightUnit(): WeightUnit {
    return this.data.settings.weightUnit ?? 'kg';
  }

  /** 某動作的休息秒數：有個別設定用個別設定，否則用預設 */
  restSecondsFor(exerciseId: string): number {
    const s = this.data.settings;
    return s.restByExercise?.[exerciseId] ?? s.defaultRestSeconds;
  }

  /** 設定某動作的休息秒數；null 代表改回預設 */
  async setExerciseRest(exerciseId: string, seconds: number | null): Promise<void> {
    const rest = { ...this.data.settings.restByExercise };
    if (seconds === null) delete rest[exerciseId];
    else rest[exerciseId] = seconds;
    const { restByExercise: _, ...settings } = this.data.settings;
    await this.commit({
      ...this.data,
      settings: Object.keys(rest).length > 0 ? { ...settings, restByExercise: rest } : settings,
    });
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    await this.commit({ ...this.data, settings: { ...this.data.settings, ...patch } });
  }

  // ───────── 整體資料（匯出、匯入、清除） ─────────

  /** 目前完整資料（唯讀），給畫面顯示筆數、大小用；不要修改，要改請用寫入方法 */
  getData(): Readonly<AppData> {
    return this.data;
  }

  /** 目前完整資料的深拷貝，供匯出使用 */
  exportData(): AppData {
    return structuredClone(this.data);
  }

  /** 以匯入的資料取代全部；會先經過版本升級與結構檢查，並在本機先備份目前資料 */
  async replaceAll(data: AppData): Promise<void> {
    await this.adapter.backupRaw('before-import');
    await this.commit({ ...data, activeDraft: null });
  }

  /** 清除所有資料，回到初始狀態 */
  async clearAll(): Promise<void> {
    await this.adapter.clear();
    this.data = createEmptyData();
    this._loadStatus = { ok: true, isNew: true };
    this.listeners.forEach((fn) => fn());
  }
}
