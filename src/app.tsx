import type { FunctionComponent } from 'preact';
import { BottomNav } from './components/BottomNav';
import { DialogHost } from './components/Dialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RestTimerBar } from './components/RestTimerBar';
import { ToastHost } from './components/Toast';
import { useHashRoute, type Route } from './hooks/useHashRoute';
import { BodyPage } from './pages/BodyPage';
import { ChartsPage } from './pages/ChartsPage';
import { DietPage } from './pages/DietPage';
import { LogPage } from './pages/LogPage';
import { SessionEditorRoute } from './pages/SessionEditor';
import { SessionView } from './pages/SessionView';
import { SettingsPage } from './pages/SettingsPage';
import { RoutinePlayer } from './pages/RoutinePlayer';
import { ToolsPage } from './pages/ToolsPage';

const PAGES: Record<Exclude<Route, 'tools' | 'charts'>, FunctionComponent> = {
  log: LogPage,
  body: BodyPage,
  diet: DietPage,
  settings: SettingsPage,
};

export function App() {
  const { route, params } = useHashRoute();

  // 訓練進行中是全螢幕畫面，隱藏底部導覽，避免誤觸跳走
  const isEditor = route === 'log' && params[0] === 'session';
  // 熱身、拉伸的引導播放（全螢幕）
  const playerMode =
    route === 'tools' && (params[0] === 'stretch' || params[0] === 'warmup') && params[1] === 'play' ? params[0] : null;
  const isStretch = playerMode !== null;
  const fullscreen = isEditor || isStretch;
  const viewId = route === 'log' && params[0] === 'view' ? params[1] : undefined;

  let content;
  if (isEditor) content = <SessionEditorRoute />;
  else if (playerMode) content = <RoutinePlayer key={`${playerMode}-${params[2]}`} mode={playerMode} musclesParam={params[2]} />;
  else if (viewId) content = <SessionView id={viewId} />;
  else if (route === 'tools') content = <ToolsPage tab={params[0]} param={params[1]} />;
  else if (route === 'charts') content = <ChartsPage params={params} />;
  else {
    const Page = PAGES[route];
    content = <Page />;
  }

  return (
    <>
      <main class={fullscreen ? 'page page-editor' : 'page'}>
        <ErrorBoundary resetKey={[route, ...params].join('/')}>{content}</ErrorBoundary>
      </main>
      {!fullscreen && <BottomNav current={route} />}
      {!isStretch && <RestTimerBar aboveNav={!fullscreen} />}
      <DialogHost />
      <ToastHost />
    </>
  );
}
