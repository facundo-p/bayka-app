import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';
import styles from '../StatCard.module.css';

test('renderiza label y value, sin variante de alerta por defecto', () => {
  const { container } = render(<StatCard label="Con GPS" value="94%" />);
  expect(screen.getByText('Con GPS')).toBeInTheDocument();
  expect(screen.getByText('94%')).toBeInTheDocument();
  expect(container.firstChild).not.toHaveClass(styles.warn);
});

test('bar dibuja un fill con el ancho y color provistos', () => {
  const { container } = render(
    <StatCard label="Con GPS" value="94%" bar={{ pct: 94, color: 'var(--color-secondary)' }} />,
  );
  const fill = container.querySelector(`.${styles.fill}`) as HTMLElement;
  expect(fill).toBeInTheDocument();
  expect(fill.style.getPropertyValue('--ancho')).toBe('94%');
  expect(fill.style.getPropertyValue('--color')).toBe('var(--color-secondary)');
});

test('variante warn aplica la clase y muestra el hint con ícono', () => {
  const { container } = render(
    <StatCard label="N/N sin resolver" value="124" variant="warn" hint="requieren atención" />,
  );
  expect(container.firstChild).toHaveClass(styles.warn);
  expect(screen.getByText('requieren atención')).toBeInTheDocument();
  expect(container.querySelector(`.${styles.hintIcon}`)).toBeInTheDocument();
});
