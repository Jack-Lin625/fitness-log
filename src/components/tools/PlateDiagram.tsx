import { formatNumber } from '../../lib/number';

/** 各規格槓片的外觀（高度、厚度），比例參考比賽槓片 */
const PLATE_SHAPE: Record<string, { h: number; w: number }> = {
  '25': { h: 150, w: 22 },
  '20': { h: 150, w: 19 },
  '15': { h: 134, w: 17 },
  '10': { h: 118, w: 15 },
  '5': { h: 88, w: 12 },
  '2.5': { h: 70, w: 10 },
  '1.25': { h: 56, w: 8 },
  '0.5': { h: 46, w: 6 },
};

const shapeOf = (kg: number) => PLATE_SHAPE[String(kg)] ?? { h: 50, w: 8 };

/** 槓片的 CSS 類別，顏色對應比賽槓片（25 紅、20 藍、15 黃、10 綠、5 白…） */
export const plateClass = (kg: number) => `plate-${String(kg).replace('.', '_')}`;

/** 畫出槓鈴「一邊」的側面：套筒、卡扣與由內而外的槓片 */
export function PlateDiagram({ plates }: { plates: number[] }) {
  const gap = 2;
  const startX = 44; // 卡扣右側
  const platesWidth = plates.reduce((s, p) => s + shapeOf(p).w + gap, 0);
  const width = Math.max(260, startX + platesWidth + 40);
  const mid = 90;

  let x = startX;
  return (
    <svg
      class="plate-diagram"
      viewBox={`0 0 ${width} 180`}
      role="img"
      aria-label={plates.length ? `每邊槓片：${plates.map(formatNumber).join('、')} 公斤` : '空槓'}
    >
      {/* 槓身與套筒 */}
      <rect x="0" y={mid - 5} width="30" height="10" rx="2" class="bar-shaft" />
      <rect x="30" y={mid - 16} width="10" height="32" rx="2" class="bar-collar" />
      <rect x="40" y={mid - 9} width={width - 44} height="18" rx="4" class="bar-sleeve" />
      {plates.map((p, i) => {
        const { h, w } = shapeOf(p);
        const px = x;
        x += w + gap;
        return (
          <rect key={i} x={px} y={mid - h / 2} width={w} height={h} rx="3" class={`plate ${plateClass(p)}`} />
        );
      })}
    </svg>
  );
}
