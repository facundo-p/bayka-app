import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from '../SegmentedControl';
import styles from '../SegmentedControl.module.css';

const OPCIONES = [
  { value: 'arboles', label: 'Árboles' },
  { value: 'grupos', label: 'Grupos' },
  { value: 'parcelas', label: 'Parcelas' },
] as const;

test('marca como activa la opción seleccionada', () => {
  render(<SegmentedControl options={[...OPCIONES]} value="grupos" onChange={() => {}} aria-label="Vista" />);
  const activo = screen.getByRole('radio', { name: 'Grupos' });
  expect(activo).toHaveAttribute('aria-checked', 'true');
  expect(activo.className).toContain(styles.active);
});

test('click invoca onChange con el value de la opción', async () => {
  const onChange = vi.fn();
  render(<SegmentedControl options={[...OPCIONES]} value="arboles" onChange={onChange} aria-label="Vista" />);
  await userEvent.click(screen.getByRole('radio', { name: 'Parcelas' }));
  expect(onChange).toHaveBeenCalledWith('parcelas');
});

test('renderiza sublabel cuando está presente (presets GPS)', () => {
  render(
    <SegmentedControl
      options={[{ value: 1, label: '1', sublabel: 'cada árbol' }]}
      value={1}
      onChange={() => {}}
      aria-label="Frecuencia"
    />,
  );
  expect(screen.getByText('cada árbol')).toBeInTheDocument();
});
