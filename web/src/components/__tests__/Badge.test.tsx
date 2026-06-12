import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';
import styles from '../Badge.module.css';

test('mapea cada variante a su clase y usa neutral por defecto', () => {
  render(
    <>
      <Badge variant="activa">Activa</Badge>
      <Badge variant="finalizada">Finalizada</Badge>
      <Badge>Otro</Badge>
    </>,
  );
  expect(screen.getByText('Activa').className).toContain(styles.activa);
  expect(screen.getByText('Finalizada').className).toContain(styles.finalizada);
  expect(screen.getByText('Otro').className).toContain(styles.neutral);
});
