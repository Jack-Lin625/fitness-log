import { useEffect, useState } from 'preact/hooks';
import { repo } from '../data';

/**
 * 讓元件在資料變化時重新渲染。
 * 用法：const r = useRepository(); r.getSessions() …
 */
export function useRepository() {
  const [, setRevision] = useState(0);
  useEffect(() => repo.subscribe(() => setRevision((n) => n + 1)), []);
  return repo;
}
