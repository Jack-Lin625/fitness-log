import { PageHeader } from '../components/PageHeader';
import { CalendarView } from '../components/charts/CalendarView';
import { ExerciseHistory } from '../components/ExerciseHistory';
import { useRepository } from '../hooks/useRepository';
import { PrWall } from '../components/charts/PrWall';
import { TrendView } from '../components/charts/TrendView';
import { VolumeView } from '../components/charts/VolumeView';

type Tab = 'calendar' | 'trend' | 'volume' | 'pr';

const TABS: { id: Tab; label: string }[] = [
  { id: 'calendar', label: '日曆' },
  { id: 'trend', label: '1RM 趨勢' },
  { id: 'volume', label: '訓練量' },
  { id: 'pr', label: 'PR 牆' },
];

/** 進步圖表頁；分頁與選擇的動作都記在網址上（#/charts/trend/squat） */
export function ChartsPage({ params }: { params: string[] }) {
  const repo = useRepository();
  // 單一動作的完整歷史：#/charts/exercise/<動作 id>
  if (params[0] === 'exercise' && params[1]) {
    return (
      <>
        <button type="button" class="btn-text back-link" onClick={() => history.back()}>
          ‹ 返回
        </button>
        <PageHeader title={repo.getExercise(params[1])?.name ?? '已刪除的動作'} subtitle="完整歷史紀錄" />
        <ExerciseHistory exerciseId={params[1]} />
      </>
    );
  }
  const tab: Tab = params[0] === 'volume' || params[0] === 'pr' || params[0] === 'calendar' ? params[0] : 'trend';

  return (
    <>
      <PageHeader title="進步圖表" />
      <div class="segmented segmented-4" role="tablist">
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
      {tab === 'calendar' && <CalendarView />}
      {tab === 'trend' && <TrendView exerciseId={params[1]} />}
      {tab === 'volume' && <VolumeView />}
      {tab === 'pr' && <PrWall />}
    </>
  );
}
