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

test('roving-tabindex: solo la opción seleccionada es tabbable', () => {
  render(<SegmentedControl options={[...OPCIONES]} value="grupos" onChange={() => {}} aria-label="Vista" />);
  expect(screen.getByRole('radio', { name: 'Grupos' })).toHaveAttribute('tabindex', '0');
  expect(screen.getByRole('radio', { name: 'Árboles' })).toHaveAttribute('tabindex', '-1');
  expect(screen.getByRole('radio', { name: 'Parcelas' })).toHaveAttribute('tabindex', '-1');
});

test('flecha derecha selecciona y enfoca la opción siguiente', async () => {
  const onChange = vi.fn();
  render(<SegmentedControl options={[...OPCIONES]} value="arboles" onChange={onChange} aria-label="Vista" />);
  const arboles = screen.getByRole('radio', { name: 'Árboles' });
  arboles.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(onChange).toHaveBeenCalledWith('grupos');
  expect(screen.getByRole('radio', { name: 'Grupos' })).toHaveFocus();
});

test('flecha izquierda envuelve del primero al último', async () => {
  const onChange = vi.fn();
  render(<SegmentedControl options={[...OPCIONES]} value="arboles" onChange={onChange} aria-label="Vista" />);
  screen.getByRole('radio', { name: 'Árboles' }).focus();
  await userEvent.keyboard('{ArrowLeft}');
  expect(onChange).toHaveBeenCalledWith('parcelas');
  expect(screen.getByRole('radio', { name: 'Parcelas' })).toHaveFocus();
});

test('Home y End saltan al primero y al último', async () => {
  const onChange = vi.fn();
  render(<SegmentedControl options={[...OPCIONES]} value="grupos" onChange={onChange} aria-label="Vista" />);
  screen.getByRole('radio', { name: 'Grupos' }).focus();
  await userEvent.keyboard('{End}');
  expect(onChange).toHaveBeenLastCalledWith('parcelas');
  await userEvent.keyboard('{Home}');
  expect(onChange).toHaveBeenLastCalledWith('arboles');
});

test('flecha salta opciones deshabilitadas', async () => {
  const onChange = vi.fn();
  render(
    <SegmentedControl
      options={[
        { value: 'arboles', label: 'Árboles' },
        { value: 'grupos', label: 'Grupos', disabled: true },
        { value: 'parcelas', label: 'Parcelas' },
      ]}
      value="arboles"
      onChange={onChange}
      aria-label="Vista"
    />,
  );
  screen.getByRole('radio', { name: 'Árboles' }).focus();
  await userEvent.keyboard('{ArrowRight}');
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
