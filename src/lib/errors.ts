/** 把任意錯誤轉成可以顯示給使用者的訊息 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '發生未知錯誤';
}
