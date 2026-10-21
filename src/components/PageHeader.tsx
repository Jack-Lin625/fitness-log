import type { ComponentChildren } from 'preact';

interface Props {
  title: string;
  /** 標題下方的補充資訊（如日期） */
  subtitle?: string;
  /** 右側動作按鈕 */
  action?: ComponentChildren;
}

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <header class="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p class="page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
