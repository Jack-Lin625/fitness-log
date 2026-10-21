import { PageHeader } from '../components/PageHeader';
import { PrWall } from '../components/charts/PrWall';
import { TrendView } from '../components/charts/TrendView';
import { VolumeView } from '../components/charts/VolumeView';

type Tab = 'trend' | 'volume' | 'pr';

const TABS: { id: Tab; label: string }[] = [
  { id: 'trend', label: '1RM 趨勢' },
  { id: 'volume', label: '部位訓練量' },
  { id: 'pr', label: 'PR 牆' },
];

/** 進步圖表頁；分頁與選擇的動作都記在網址上（#/charts/trend/squat） */
export function ChartsPage({ params }: { params: string[] }) {
  const tab: Tab = params[0] === 'volume' || params[0] === 'pr' ? params[0] : 'trend';

  return (
    <>
      <PageHeader title="進步圖表" />
      <div class="segmented segmented-3" role="tablist">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`#/charts/${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            class={tab === t.id ? 'segment is-active' : 'segment'}
          >
            {t.label}
          </a>
        ))}
      </div>
      {tab === 'trend' && <TrendView exerciseId={params[1]} />}
      {tab === 'volume' && <VolumeView />}
      {tab === 'pr' && <PrWall />}
    </>
  );
}
