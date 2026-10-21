import type { FunctionComponent } from 'preact';
import { BottomNav } from './components/BottomNav';
import { DialogHost } from './components/Dialog';
import { RestTimerBar } from './components/RestTimerBar';
import { ToastHost } from './components/Toast';
import { useHashRoute, type Route } from './hooks/useHashRoute';
import { BodyPage } from './pages/BodyPage';
import { ChartsPage } from './pages/ChartsPage';
import { LogPage } from './pages/LogPage';
import { SessionEditorRoute } from './pages/SessionEditor';
import { SessionView } from './pages/SessionView';
import { SettingsPage } from './pages/SettingsPage';
import { StretchPlayer } from './pages/StretchPlayer';
import { ToolsPage } from './pages/ToolsPage';

const PAGES: Record<Exclude<Route, 'tools' | 'charts'>, FunctionComponent> = {
  log: LogPage,
  body: BodyPage,
  settings: SettingsPage,
};

export function App() {
  const { route, params } = useHashRoute();

  // 訓練進行中是全螢幕畫面，隱藏底部導覽，避免誤觸跳走
  const isEditor = route === 'log' && params[0] === 'session';
  const isStretch = route === 'tools' && params[0] === 'stretch' && params[1] === 'play';
  const fullscreen = isEditor || isStretch;
  const viewId = route === 'log' && params[0] === 'view' ? params[1] : undefined;

  let content;
  if (isEditor) content = <SessionEditorRoute />;
  else if (isStretch) content = <StretchPlayer key={params[2]} partsParam={params[2]} />;
  else if (viewId) content = <SessionView id={viewId} />;
  else if (route === 'tools') content = <ToolsPage tab={params[0]} />;
  else if (route === 'charts') content = <ChartsPage params={params} />;
  else {
    const Page = PAGES[route];
    content = <Page />;
  }

  return (
    <>
      <main class={fullscreen ? 'page page-editor' : 'page'}>{content}</main>
      {!fullscreen && <BottomNav current={route} />}
      {!isStretch && <RestTimerBar aboveNav={!fullscreen} />}
      <DialogHost />
      <ToastHost />
    </>
  );
}
