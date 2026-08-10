import { useGameStore } from './engine/store';
import { useAudioUnlock } from './audio/useAudioUnlock';
import { TitleScreen } from './components/TitleScreen';
import { GameScreen } from './components/GameScreen';
import { DebugPanel } from './components/DebugPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/game.css';

function App() {
  const state = useGameStore(s => s.state);
  // 자동재생 정책 — 첫 제스처 전까지 오디오 컨텍스트를 만들지 않는다.
  useAudioUnlock();

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
