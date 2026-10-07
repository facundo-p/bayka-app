import { render, screen } from '@testing-library/react';
import { CampoBusqueda } from '../CampoBusqueda';
import styles from '../CampoBusqueda.module.css';

const contenedor = (label: string) => screen.getByLabelText(label).closest(`.${styles.campo}`);

test('cada densidad aplica su clase y la normal ninguna', () => {
  const props = { placeholder: '', value: '', onChange: () => {} };
  render(
    <>
      <CampoBusqueda label="Normal" {...props} />
      <CampoBusqueda label="Compacta" densidad="compacta" {...props} />
      <CampoBusqueda label="Mínima" densidad="minima" {...props} />
    </>,
  );
  expect(contenedor('Normal')?.className).toBe(styles.campo);
  expect(contenedor('Compacta')?.className).toContain(styles.compacta);
  expect(contenedor('Mínima')?.className).toContain(styles.minima);
});
