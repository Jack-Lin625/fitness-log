import { PageHeader } from '../components/PageHeader';
import { OneRepMaxTool } from '../components/tools/OneRepMaxTool';
import { PlateCalculator } from '../components/tools/PlateCalculator';
import { StretchSetup } from '../components/tools/StretchSetup';
import { WarmupSetup } from '../components/tools/WarmupSetup';

type Tab = 'plates' | '1rm' | 'warmup' | 'stretch';

const TABS: { id: Tab; label: string }[] = [
  { id: 'plates', label: '槓片' },
  { id: '1rm', label: '1RM' },
  { id: 'warmup', label: '熱身' },
  { id: 'stretch', label: '拉伸' },
];

/** 計算工具頁；目前分頁記在網址上（#/tools/1rm），重新整理也會停在同一頁 */
export function ToolsPage({ tab }: { tab: string | undefined }) {
  const current: Tab = tab === '1rm' || tab === 'stretch' || tab === 'warmup' ? tab : 'plates';

  return (
    <>
      <PageHeader title="計算工具" />
      <div class="segmented segmented-4" role="tablist">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`#/tools/${t.id}`}
            role="tab"
            aria-selected={current === t.id}
            class={current === t.id ? 'segment is-active' : 'segment'}
          >
            {t.label}
          </a>
        ))}
      </div>
      {current === 'plates' && <PlateCalculator />}
      {current === '1rm' && <OneRepMaxTool />}
      {current === 'warmup' && <WarmupSetup />}
      {current === 'stretch' && <StretchSetup />}
    </>
  );
}
