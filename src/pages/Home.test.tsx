/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Home from './Home';

vi.mock('../components/HistoryDialog', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div role="dialog">Historique des operations</div> : null
  ),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderHome = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route
        path="*"
        element={(
          <>
            <Home />
            <LocationProbe />
          </>
        )}
      />
    </Routes>
  </MemoryRouter>
);

describe('Home', () => {
  it('shows operational hub actions and quick access modules', () => {
    renderHome();

    expect(screen.getByRole('heading', { name: /poste de conduite atlas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ouvrir fonctions opérationnelles/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ouvrir communication ops/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ouvrir zonage opérationnel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ouvrir sitac/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ouvrir oct/i })).toBeInTheDocument();
  });

  it('routes primary and quick actions to existing modules', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: /ouvrir sitac/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/sitac');

    fireEvent.click(screen.getByRole('button', { name: /ouvrir oct/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/oct');
  });

  it('opens the history dialog from the visible history action', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: /ouvrir l'historique/i }));

    expect(screen.getByRole('dialog', { name: '' })).toHaveTextContent('Historique des operations');
  });
});
