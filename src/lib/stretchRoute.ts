import { BODY_PARTS, type BodyPart } from '../types/models';

/** 拉伸播放頁的網址，例如 /tools/stretch/play/legs,core */
export const stretchPlayPath = (parts: BodyPart[]) => `/tools/stretch/play/${parts.join(',')}`;

/** 從網址解析部位 */
export function parseParts(param: string | undefined): BodyPart[] {
  const wanted = (param ?? '').split(',');
  return BODY_PARTS.filter((p) => wanted.includes(p));
}

/** 預估時間顯示：「約 6 分鐘」 */
export const minutesLabel = (seconds: number) => `約 ${Math.max(1, Math.round(seconds / 60))} 分鐘`;
