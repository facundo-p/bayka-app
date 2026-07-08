import { render, screen } from '@testing-library/react';
import { HeroMetric } from '../HeroMetric';
import styles from '../HeroMetric.module.css';

test('formatea el valor con separador de miles y arma el pie con el objetivo', () => {
  const { container } = render(
    <HeroMetric overline="Árboles registrados" valor={7642} objetivo={8000} porcentaje={96} />,
  );
  expect(screen.getByText('7.642')).toBeInTheDocument();
  expect(screen.getByText('Árboles registrados')).toBeInTheDocument();
  expect(screen.getByText('Meta de la temporada · 8.000 · 96%')).toBeInTheDocument();
  const fill = container.querySelector(`.${styles.fill}`) as HTMLElement;
  expect(fill.style.width).toBe('96%');
});

test('usa el metaLabel personalizado cuando se provee', () => {
  render(<HeroMetric overline="X" valor={10} objetivo={20} porcentaje={50} metaLabel="Objetivo anual" />);
  expect(screen.getByText('Objetivo anual · 20 · 50%')).toBeInTheDocument();
});

test('sin objetivo (<=0) oculta la barra y muestra "Meta no definida"', () => {
  const { container } = render(
    <HeroMetric overline="Árboles registrados" valor={42} objetivo={0} porcentaje={0} />,
  );
  expect(screen.getByText('42')).toBeInTheDocument();
  expect(screen.getByText('Meta no definida')).toBeInTheDocument();
  expect(screen.queryByText(/· 0 · 0%/)).not.toBeInTheDocument();
  expect(container.querySelector(`.${styles.fill}`)).toBeNull();
});
