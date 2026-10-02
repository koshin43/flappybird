import { Component, type ReactNode } from 'react';
import css from './ErrorBoundary.module.css';

/** Last line of defence: show the failure instead of continuing with broken state. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={css.error} role="alert">
        <h1>Something went wrong</h1>
        <p>{String(this.state.error)}</p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
