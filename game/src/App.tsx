import { useGameStore } from './engine/store';
import { TitleScreen } from './components/TitleScreen';
import { GameScreen } from './components/GameScreen';
import { DebugPanel } from './components/DebugPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/game.css';

function App() {
  const state = useGameStore(s => s.state);

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
