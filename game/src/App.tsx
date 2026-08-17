import { useGameStore } from './engine/store';
import { useAudioUnlock } from './audio/useAudioUnlock';
import { useAudioLifecycle } from './audio/useAudioLifecycle';
import { TitleScreen } from './components/TitleScreen';
import { GameScreen } from './components/GameScreen';
import { DebugPanel } from './components/DebugPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/pretendard.css';  // @font-face 먼저 — game.css가 이 family를 참조한다
import './styles/game.css';

function App() {
  const state = useGameStore(s => s.state);
  // 자동재생 정책 — 첫 제스처 전까지 오디오 컨텍스트를 만들지 않는다.
  useAudioUnlock();
  // 탭을 떠나면 재우고 돌아오면 깨운다(지속음이 백그라운드에서 계속 흐르는 것 방지).
  useAudioLifecycle();

  return (
    <>
      <ErrorBoundary>
        {!state ? <TitleScreen /> : <GameScreen />}
      </ErrorBoundary>
      {import.meta.env.DEV && state && <DebugPanel />}
    </>
  );
}

export default App;
