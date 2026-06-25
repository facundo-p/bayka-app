import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toggle } from '../Toggle';
import styles from '../Toggle.module.css';

test('refleja el estado checked con role switch y la clase on', () => {
  render(<Toggle checked onChange={() => {}} aria-label="Captura obligatoria" />);
  const sw = screen.getByRole('switch', { name: 'Captura obligatoria' });
  expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(sw.className).toContain(styles.on);
});

test('click invoca onChange con el valor invertido', async () => {
  const onChange = vi.fn();
  render(<Toggle checked={false} onChange={onChange} aria-label="Visible" />);
  await userEvent.click(screen.getByRole('switch', { name: 'Visible' }));
  expect(onChange).toHaveBeenCalledWith(true);
});

test('disabled no dispara onChange', async () => {
  const onChange = vi.fn();
  render(<Toggle checked={false} onChange={onChange} disabled aria-label="X" />);
  await userEvent.click(screen.getByRole('switch', { name: 'X' }));
  expect(onChange).not.toHaveBeenCalled();
});
