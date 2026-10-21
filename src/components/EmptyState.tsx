import type { ComponentChildren } from 'preact';

interface Props {
  title: string;
  body: string;
  action?: ComponentChildren;
}

/** 空白狀態：說明這裡會出現什麼，並引導下一步 */
export function EmptyState({ title, body, action }: Props) {
  return (
    <section class="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  );
}
