import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renderiza el placeholder de Bayka Gestión', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Bayka Gestión' })).toBeInTheDocument();
});
