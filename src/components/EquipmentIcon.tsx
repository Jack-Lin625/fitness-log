import type { JSX } from 'preact';
import { EQUIPMENT_LABELS } from '../data/catalog';
import type { Equipment } from '../types/models';

/*
 * 器材插圖（自繪，64×64 格線）
 * - 線條用 currentColor，深淺色模式自動適應
 * - class="w"：配重片、槓片等「重量」部位，用主色填滿
 * - class="pad"：坐墊、靠墊，用淡色填滿
 * - y = 56 為地面
 */
const FLOOR = <path d="M4 56H60" class="floor" />;

/** 配重片堆疊（纜繩機、機器共用） */
const stack = (x: number, y: number, w: number, h: number) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx="1.5" class="w" />
    {Array.from({ length: Math.floor(h / 5) - 1 }, (_, i) => (
      <path key={i} d={`M${x} ${y + (i + 1) * 5}H${x + w}`} class="thin" />
    ))}
  </>
);

const ICONS: Record<Equipment, JSX.Element> = {
  barbell: (
    <>
      <path d="M4 32H60" />
      <rect x="9" y="19" width="6" height="26" rx="1.5" class="w" />
      <rect x="16" y="23" width="4" height="18" rx="1" class="w" />
      <rect x="49" y="19" width="6" height="26" rx="1.5" class="w" />
      <rect x="44" y="23" width="4" height="18" rx="1" class="w" />
      <path d="M22 28V36M42 28V36" />
    </>
  ),
  ezbar: (
    <>
      <path d="M4 32H19L23 27L28 37L32 27L36 37L41 27L45 32H60" />
      <rect x="9" y="21" width="6" height="22" rx="1.5" class="w" />
      <rect x="49" y="21" width="6" height="22" rx="1.5" class="w" />
    </>
  ),
  trapbar: (
    <>
      <path d="M19 20H45L54 32L45 44H19L10 32Z" />
      <path d="M25 27V37M39 27V37" class="bold" />
      <path d="M2 32H10M54 32H62" />
      <rect x="3" y="23" width="5" height="18" rx="1.5" class="w" />
      <rect x="56" y="23" width="5" height="18" rx="1.5" class="w" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M22 32H42" class="bold" />
      <rect x="10" y="21" width="12" height="22" rx="3" class="w" />
      <rect x="42" y="21" width="12" height="22" rx="3" class="w" />
    </>
  ),
  kettlebell: (
    <>
      <path d="M21 31C19 13 45 13 43 31" class="bold" />
      <path d="M26 29C26 22 38 22 38 29" />
      <circle cx="32" cy="40" r="14" class="w" />
      <path d="M24 54H40" />
    </>
  ),
  band: (
    <>
      <path d="M16 18C6 18 6 46 16 46H48C58 46 58 18 48 18Z" class="accent-line" />
      <path d="M20 24C14 24 14 40 20 40H44C50 40 50 24 44 24Z" class="thin" />
    </>
  ),
  cable: (
    <>
      <rect x="7" y="6" width="12" height="50" rx="2" />
      {stack(9, 28, 8, 26)}
      <path d="M19 10H42" />
      <circle cx="42" cy="12" r="3" />
      <path d="M42 15V40" class="thin" />
      <path d="M35 42H49" class="bold" />
      {FLOOR}
    </>
  ),
  smith: (
    <>
      <path d="M14 6V56M50 6V56" />
      <path d="M6 28H58" class="bold" />
      <rect x="4" y="19" width="5" height="18" rx="1.5" class="w" />
      <rect x="55" y="19" width="5" height="18" rx="1.5" class="w" />
      <path d="M14 24L18 28M50 24L46 28" class="thin" />
      {FLOOR}
    </>
  ),
  'chest-press-machine': (
    <>
      <rect x="13" y="14" width="6" height="28" rx="2" class="pad" />
      <rect x="13" y="40" width="20" height="6" rx="2" class="pad" />
      <path d="M22 46V56M19 22H40V32" />
      <circle cx="40" cy="34" r="2.5" />
      {stack(46, 18, 11, 36)}
      {FLOOR}
    </>
  ),
  'pec-deck': (
    <>
      <rect x="28" y="10" width="8" height="26" rx="2" class="pad" />
      <rect x="25" y="36" width="14" height="5" rx="2" class="pad" />
      <path d="M28 16C18 16 12 20 12 27M36 16C46 16 52 20 52 27" />
      <rect x="8" y="26" width="7" height="15" rx="2" class="w" />
      <rect x="49" y="26" width="7" height="15" rx="2" class="w" />
      <path d="M32 41V56" />
      {FLOOR}
    </>
  ),
  'shoulder-press-machine': (
    <>
      <rect x="15" y="16" width="6" height="26" rx="2" class="pad" />
      <rect x="15" y="40" width="18" height="6" rx="2" class="pad" />
      <path d="M22 46V56M21 18H30V8H40" />
      <circle cx="40" cy="8" r="2.5" />
      {stack(46, 16, 11, 38)}
      {FLOOR}
    </>
  ),
  'lateral-raise-machine': (
    <>
      <rect x="29" y="12" width="6" height="26" rx="2" class="pad" />
      <rect x="24" y="38" width="16" height="5" rx="2" class="pad" />
      <path d="M29 22L14 16M35 22L50 16" />
      <rect x="8" y="12" width="8" height="8" rx="2" class="w" />
      <rect x="48" y="12" width="8" height="8" rx="2" class="w" />
      <path d="M32 43V56" />
      {FLOOR}
    </>
  ),
  'lat-pulldown': (
    <>
      <path d="M48 6V56M18 8H50" />
      <circle cx="22" cy="10" r="2.5" />
      <path d="M22 13V22" class="thin" />
      <path d="M8 26L11 22H33L36 26" class="bold" />
      <rect x="14" y="34" width="16" height="4" rx="2" class="pad" />
      <rect x="14" y="42" width="16" height="5" rx="2" class="pad" />
      <path d="M22 47V56" />
      {stack(50, 28, 9, 26)}
      {FLOOR}
    </>
  ),
  'seated-row-machine': (
    <>
      <rect x="8" y="42" width="18" height="5" rx="2" class="pad" />
      <path d="M17 47V56" />
      <rect x="32" y="24" width="6" height="18" rx="2" class="pad" />
      <path d="M35 42V56M38 30H46" />
      <path d="M46 26V34" class="bold" />
      {stack(49, 16, 10, 38)}
      {FLOOR}
    </>
  ),
  tbar: (
    <>
      <path d="M8 54L46 24" class="bold" />
      <circle cx="50" cy="21" r="9" class="w" />
      <path d="M38 30L44 38M41 28L47 36" />
      <circle cx="8" cy="54" r="2.5" />
      {FLOOR}
    </>
  ),
  'assisted-machine': (
    <>
      <path d="M14 6V56M50 6V56M8 10H56" />
      <path d="M8 16H20M44 16H56" class="bold" />
      <rect x="23" y="32" width="18" height="5" rx="2" class="w" />
      <path d="M32 37V48M18 48H46" />
      {FLOOR}
    </>
  ),
  'leg-press': (
    <>
      <path d="M12 54L52 14" />
      <path d="M40 12L54 26" class="bold" />
      <rect x="47" y="8" width="8" height="8" rx="1.5" class="w" />
      <path d="M8 30L16 44H30" class="pad-line" />
      <path d="M18 44V56" />
      {FLOOR}
    </>
  ),
  'hack-squat': (
    <>
      <path d="M14 6L30 52M22 6L38 52" />
      <rect x="18" y="12" width="8" height="30" rx="3" transform="rotate(-19 22 27)" class="pad" />
      <path d="M14 14H24" class="bold" />
      <path d="M26 52H52" class="bold" />
      <rect x="40" y="18" width="10" height="10" rx="2" class="w" />
      {FLOOR}
    </>
  ),
  'leg-extension': (
    <>
      <rect x="11" y="14" width="6" height="24" rx="2" class="pad" />
      <rect x="11" y="36" width="22" height="6" rx="2" class="pad" />
      <circle cx="33" cy="40" r="2.5" />
      <path d="M33 40L46 46" />
      <circle cx="48" cy="48" r="5" class="w" />
      <path d="M20 42V56" />
      {FLOOR}
    </>
  ),
  'leg-curl': (
    <>
      <rect x="6" y="30" width="38" height="6" rx="2" class="pad" />
      <path d="M12 36V56M38 36V56" />
      <path d="M44 33L50 26" />
      <circle cx="51" cy="24" r="5" class="w" />
      <circle cx="44" cy="33" r="2.5" />
      {FLOOR}
    </>
  ),
  'hip-machine': (
    <>
      <rect x="28" y="10" width="8" height="26" rx="2" class="pad" />
      <rect x="22" y="36" width="20" height="5" rx="2" class="pad" />
      <rect x="13" y="26" width="7" height="14" rx="2" class="w" />
      <rect x="44" y="26" width="7" height="14" rx="2" class="w" />
      <path d="M9 30C6 33 6 37 9 40M55 30C58 33 58 37 55 40" class="thin" />
      <path d="M32 41V56" />
      {FLOOR}
    </>
  ),
  'hip-thrust-machine': (
    <>
      <rect x="6" y="28" width="20" height="6" rx="2" class="pad" />
      <path d="M14 34V56" />
      <path d="M30 32Q40 18 50 32" class="bold" />
      <path d="M50 32L56 48" />
      <rect x="52" y="44" width="8" height="8" rx="2" class="w" />
      {FLOOR}
    </>
  ),
  'calf-machine': (
    <>
      <path d="M46 6V56M32 10H46" />
      <rect x="18" y="12" width="24" height="6" rx="2" class="pad" />
      <rect x="20" y="48" width="20" height="5" rx="1.5" class="w" />
      {stack(48, 22, 10, 32)}
      {FLOOR}
    </>
  ),
  'arm-machine': (
    <>
      <path d="M12 40L28 24L34 30L18 46Z" class="pad" />
      <rect x="6" y="46" width="16" height="5" rx="2" class="pad" />
      <path d="M30 26L40 14" />
      <circle cx="41" cy="12" r="3" />
      <path d="M22 46V56" />
      {stack(47, 18, 10, 36)}
      {FLOOR}
    </>
  ),
  'ab-machine': (
    <>
      <rect x="15" y="16" width="6" height="26" rx="2" class="pad" />
      <rect x="15" y="40" width="18" height="6" rx="2" class="pad" />
      <path d="M21 16Q33 10 35 22" class="bold" />
      <path d="M24 46V56" />
      {stack(45, 18, 11, 36)}
      {FLOOR}
    </>
  ),
  bench: (
    <>
      <rect x="8" y="28" width="48" height="7" rx="2" class="pad" />
      <path d="M14 35V54M50 35V54M9 54H19M45 54H55" />
      {FLOOR}
    </>
  ),
  'preacher-bench': (
    <>
      <path d="M22 36L42 18L48 24L28 42Z" class="pad" />
      <rect x="6" y="42" width="16" height="5" rx="2" class="pad" />
      <path d="M34 34V56M14 47V56" />
      <path d="M44 14H56" class="bold" />
      {FLOOR}
    </>
  ),
  'back-extension': (
    <>
      <path d="M10 54L42 22" />
      <path d="M36 16L50 30" class="pad-line" />
      <circle cx="16" cy="44" r="3.5" class="pad" />
      <circle cx="22" cy="48" r="3.5" class="pad" />
      <path d="M42 22L56 56" />
      {FLOOR}
    </>
  ),
  'pullup-bar': (
    <>
      <path d="M12 8V56M52 8V56" />
      <path d="M6 12H58" class="accent-line" />
      {FLOOR}
    </>
  ),
  'dip-station': (
    <>
      <path d="M16 22V56M48 22V56M22 22V56M42 22V56" class="thin" />
      <path d="M10 22H26M38 22H54" class="accent-line" />
      {FLOOR}
    </>
  ),
  'ab-wheel': (
    <>
      <circle cx="32" cy="36" r="13" class="accent-line" />
      <circle cx="32" cy="36" r="3" />
      <path d="M10 36H26M38 36H54" class="bold" />
      {FLOOR}
    </>
  ),
  box: (
    <>
      <path d="M14 22H50L54 56H10Z" class="pad" />
      <rect x="25" y="32" width="14" height="5" rx="2.5" />
    </>
  ),
  bodyweight: (
    <>
      <circle cx="32" cy="11" r="5" class="w" />
      <path d="M32 17V36M20 25H44M32 36L24 54M32 36L40 54" class="bold" />
    </>
  ),
  other: (
    <>
      <rect x="12" y="12" width="40" height="40" rx="10" />
      <circle cx="22" cy="32" r="3" class="w" />
      <circle cx="32" cy="32" r="3" class="w" />
      <circle cx="42" cy="32" r="3" class="w" />
    </>
  ),
};

interface Props {
  equipment: Equipment;
  /** 顯示尺寸（px） */
  size?: number;
  /** 是否給螢幕閱讀器讀出器材名稱；裝飾用時設為 false */
  labelled?: boolean;
}

/** 器材插圖 */
export function EquipmentIcon({ equipment, size = 40, labelled = false }: Props) {
  return (
    <svg
      class="eq-icon"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      {...(labelled ? { role: 'img', 'aria-label': EQUIPMENT_LABELS[equipment] } : { 'aria-hidden': 'true' })}
    >
      {ICONS[equipment]}
    </svg>
  );
}
