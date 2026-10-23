import { useEffect, useState } from 'preact/hooks';
import { PageHeader } from '../components/PageHeader';
import { OneRepMaxTool } from '../components/tools/OneRepMaxTool';
import { PlateCalculator } from '../components/tools/PlateCalculator';
import { StretchSetup } from '../components/tools/StretchSetup';
import { WarmupSetup } from '../components/tools/WarmupSetup';

type Tab = 'plates' | '1rm' | 'warmup' | 'stretch' | 'form';

const TABS: { id: Tab; label: string }[] = [
  { id: 'plates', label: '槓片' },
  { id: '1rm', label: '1RM' },
  { id: 'warmup', label: '熱身' },
  { id: 'stretch', label: '拉伸' },
  { id: 'form', label: '姿勢' },
];

type FormCheckComponent = typeof import('../components/tools/FormCheck').FormCheck;

/** 姿勢檢查的程式只在打開這個分頁時才下載 */
function LazyFormCheck() {
  const [Comp, setComp] = useState<FormCheckComponent | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    import('../components/tools/FormCheck')
      .then((m) => setComp(() => m.FormCheck))
      .catch(() => setFailed(true));
  }, []);
  if (Comp) return <Comp />;
  return <p class="muted">{failed ? '載入失敗，請確認網路後再試' : '載入中…'}</p>;
}

/** 計算工具頁；目前分頁記在網址上（#/tools/1rm），重新整理也會停在同一頁 */
export function ToolsPage({ tab }: { tab: string | undefined }) {
  const current: Tab = tab === '1rm' || tab === 'stretch' || tab === 'warmup' || tab === 'form' ? tab : 'plates';

  return (
    <>
      <PageHeader title="計算工具" />
      <div class="segmented segmented-5" role="tablist">
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
      {current === 'form' && <LazyFormCheck />}
    </>
  );
}
