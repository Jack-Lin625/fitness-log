import type {
  AppData,
  BodyMetric,
  Exercise,
  Settings,
  WorkoutDraft,
  WorkoutSession,
  WorkoutSet,
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

  /** 所有動作（內建 + 自訂），預設排除已封存 */
  getExercises(includeArchived = false): Exercise[] {
    const all = [...DEFAULT_EXERCISES, ...this.data.customExercises];
    return includeArchived ? all : all.filter((e) => !e.archived);
  }

  /** 依 id 取得動作（包含已封存，讓舊紀錄仍能顯示名稱） */
  getExercise(id: string): Exercise | undefined {
    return this.getExercises(true).find((e) => e.id === id);
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

  // ───────── 訓練 ─────────

  /** 所有訓練，新到舊排序 */
  getSessions(): WorkoutSession[] {
    return [...this.data.sessions].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
    );
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
    for (const session of this.getSessions()) {
      if (session.id === excludeSessionId) continue;
      const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
      if (ex) return { date: session.date, sets: ex.sets };
    }
    return null;
  }

  /** 最近用過的動作 id（新到舊、不重複） */
  getRecentExerciseIds(limit: number): string[] {
    const seen = new Set<string>();
    for (const session of this.getSessions()) {
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

  async saveDraft(draft: WorkoutDraft): Promise<void> {
    await this.commit({ ...this.data, activeDraft: draft });
  }

  async clearDraft(): Promise<void> {
    await this.commit({ ...this.data, activeDraft: null });
  }

  /** 完成訓練：儲存紀錄並清除草稿（同一次寫入，不會只成功一半） */
  async finishDraft(session: WorkoutSession): Promise<void> {
    const exists = this.data.sessions.some((s) => s.id === session.id);
    const sessions = exists
      ? this.data.sessions.map((s) => (s.id === session.id ? session : s))
      : [...this.data.sessions, session];
    await this.commit({ ...this.data, sessions, activeDraft: null });
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

  // ───────── 設定 ─────────

  getSettings(): Settings {
    return this.data.settings;
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    await this.commit({ ...this.data, settings: { ...this.data.settings, ...patch } });
  }

  // ───────── 整體資料（匯出、匯入、清除） ─────────

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
