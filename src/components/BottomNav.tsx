import type { JSX } from 'preact';
import type { Route } from '../hooks/useHashRoute';

interface NavItem {
  route: Route;
  label: string;
  icon: JSX.Element;
}

/** 線條圖示，共用 24×24 viewBox 與 stroke 樣式 */
const icon = (paths: JSX.Element) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" class="nav-icon">
    {paths}
  </svg>
);

const ITEMS: NavItem[] = [
  {
    route: 'log',
    label: '紀錄',
    icon: icon(
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 3.5h6v3H9zM8.5 11.5h7M8.5 15.5h4.5" />
      </>,
    ),
  },
  {
    route: 'charts',
    label: '圖表',
    icon: icon(<path d="M4 4v16h16M7.5 15l3.5-4 3 2.5 5-6" />),
  },
  {
    route: 'body',
    label: '體態',
    icon: icon(
      <>
        <circle cx="12" cy="5" r="2.5" />
        <path d="M7 10.5 12 9l5 1.5M12 9v5.5M9 21l3-6.5 3 6.5" />
      </>,
    ),
  },
  {
    route: 'diet',
    label: '飲食',
    icon: icon(
      <>
        <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" />
        <path d="M8 20.5h8M9.5 4.5c-1 1.2 1 2.3 0 3.5M14.5 4.5c-1 1.2 1 2.3 0 3.5" />
      </>,
    ),
  },
  {
    route: 'tools',
    label: '工具',
    icon: icon(
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8.5 7.5h7M8.5 12h1M14.5 12h1M8.5 16.5h1M14.5 16.5h1" />
      </>,
    ),
  },
  {
    route: 'settings',
    label: '設定',
    icon: icon(
      <>
        <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
        <circle cx="15" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </>,
    ),
  },
];

/** 底部導覽列：固定在畫面底部，避開 iPhone Home 指示條 */
export function BottomNav({ current }: { current: Route }) {
  return (
    <nav class="bottom-nav" aria-label="主要頁面">
      {ITEMS.map((item) => {
        const active = item.route === current;
        return (
          <a
            key={item.route}
            href={`#/${item.route}`}
            class={active ? 'nav-item is-active' : 'nav-item'}
            aria-current={active ? 'page' : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
