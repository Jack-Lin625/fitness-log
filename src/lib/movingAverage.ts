/**
 * 移動平均
 * 以「日期」為窗口而不是「筆數」：例如 7 日平均 = 該日往前 7 天內（含當天）所有紀錄的平均。
 * 這樣即使沒有每天量，平均值仍然代表一週的狀況。
 */

export interface DatedValue {
  /** 'YYYY-MM-DD' */
  date: string;
  value: number;
}

/** 'YYYY-MM-DD' → 天數序號（用 UTC 計算，不受時區與夏令時間影響） */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 864e5);
}

/** points 需由舊到新排序；回傳每個資料點當天的移動平均 */
export function movingAverage(points: DatedValue[], windowDays = 7): DatedValue[] {
  const result: DatedValue[] = [];
  let start = 0;
  let sum = 0;
  points.forEach((p, i) => {
    sum += p.value;
    const today = dayNumber(p.date);
    // 移除超出窗口的舊資料
    while (start <= i && dayNumber(points[start]!.date) <= today - windowDays) {
      sum -= points[start]!.value;
      start++;
    }
    result.push({ date: p.date, value: sum / (i - start + 1) });
  });
  return result;
}
