import { useGameStore } from './engine/store';
import { TitleScreen } from './components/TitleScreen';
import { GameScreen } from './components/GameScreen';
import './styles/game.css';

function App() {
  const state = useGameStore(s => s.state);

  if (!state) {
    return <TitleScreen />;
  }

  return <GameScreen />;
}

export default App;
