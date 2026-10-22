import { describe, expect, it } from 'vitest';
import { calculatePlates } from './plates';

const GYM = [25, 20, 15, 10, 5, 2.5, 1.25];

describe('calculatePlates', () => {
  it('剛好湊得出來：每邊片數最少，平手時用大片', () => {
    // 每邊 40：25+15 與 20+20 都是兩片，選大片在前的組合
    expect(calculatePlates(100, 20, GYM)).toEqual({ perSide: [25, 15], total: 100, remainder: 0, belowBar: false });
  });

  it('貪婪法湊不出來時，動態規劃仍找得到', () => {
    // 只有 20 和 15：每邊 30，先掛 20 會剩 10 湊不出，正確答案是 15+15
    expect(calculatePlates(80, 20, [20, 15]).perSide).toEqual([15, 15]);
  });

  it('湊不剛好時取不超過目標的最接近重量', () => {
    expect(calculatePlates(61, 20, GYM)).toMatchObject({ perSide: [20], total: 60, remainder: 1 });
  });

  it('小數槓片沒有浮點誤差', () => {
    expect(calculatePlates(22.5, 20, [1.25])).toEqual({ perSide: [1.25], total: 22.5, remainder: 0, belowBar: false });
    expect(calculatePlates(102.5, 20, GYM)).toMatchObject({ perSide: [25, 15, 1.25], total: 102.5, remainder: 0 });
  });

  it('目標等於或小於空槓', () => {
    expect(calculatePlates(20, 20, GYM)).toMatchObject({ perSide: [], total: 20, belowBar: false });
    expect(calculatePlates(15, 20, GYM)).toMatchObject({ perSide: [], belowBar: true });
  });

  it('重複或無效的槓片不影響結果', () => {
    expect(calculatePlates(60, 20, [20, 20, 0, -5]).perSide).toEqual([20]);
    expect(calculatePlates(60, 20, [])).toMatchObject({ perSide: [], total: 20 });
  });
});
