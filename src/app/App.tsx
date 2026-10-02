import { GameScreen } from '../play';
import { ErrorBoundary } from './ErrorBoundary';
import './theme.css';

export function App() {
  return (
    <ErrorBoundary>
      <GameScreen />
    </ErrorBoundary>
  );
}
