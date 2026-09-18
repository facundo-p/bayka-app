import { render, screen } from '@testing-library/react';
import { CardTabla } from '../CardTabla';
import styles from '../CardTabla.module.css';

const desborde = vi.hoisted(() => ({ izquierda: false, derecha: false }));

vi.mock('../../hooks/useIndicioDesborde', () => ({
  useIndicioDesborde: () => desborde,
}));

beforeEach(() => {
  desborde.izquierda = false;
  desborde.derecha = false;
});

function marcoDe(tabla: HTMLElement) {
  return tabla.parentElement!.parentElement!;
}

test('sin desborde no muestra indicio a ningún lado', () => {
  render(
    <CardTabla pie="3 filas">
      <table>
        <caption>Listado</caption>
      </table>
    </CardTabla>,
  );
  const marco = marcoDe(screen.getByRole('table'));
  expect(marco.className).not.toContain(styles.masALaDerecha);
  expect(marco.className).not.toContain(styles.masALaIzquierda);
  expect(screen.getByText('3 filas')).toBeInTheDocument();
});

test('con más columnas hacia la derecha marca ese borde (#368)', () => {
  desborde.derecha = true;
  render(
    <CardTabla>
      <table>
        <caption>Listado</caption>
      </table>
    </CardTabla>,
  );
  const marco = marcoDe(screen.getByRole('table'));
  expect(marco.className).toContain(styles.masALaDerecha);
  expect(marco.className).not.toContain(styles.masALaIzquierda);
});
