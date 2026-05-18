import { useGameStore } from './engine/store';
import { TitleScreen } from './components/TitleScreen';
import { GameScreen } from './components/GameScreen';
import { DebugPanel } from './components/DebugPanel';
import './styles/game.css';

function App() {
  const state = useGameStore(s => s.state);

  return (
    <>
      {!state ? <TitleScreen /> : <GameScreen />}
      {import.meta.env.DEV && state && <DebugPanel />}
    </>
  );
}

export default App;
