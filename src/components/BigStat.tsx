interface Props {
  value: string | number;
  unit?: string;
  label: string;
  /** 標籤下方的補充說明，例如「上週 10,200」 */
  hint?: string;
}

/** 大字重點數字：在健身房一眼看得清楚 */
export function BigStat({ value, unit, label, hint }: Props) {
  return (
    <div class="big-stat">
      <div class="big-stat-value">
        <span class="num">{value}</span>
        {unit && <span class="big-stat-unit">{unit}</span>}
      </div>
      <div class="big-stat-label">{label}</div>
      {hint && <div class="big-stat-hint">{hint}</div>}
    </div>
  );
}
