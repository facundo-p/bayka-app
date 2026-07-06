/* Smoke tests de los componentes chicos: uno por componente, sin inflar LOC. */
import { render, screen } from '@testing-library/react';
import { Card } from '../Card';
import { EmptyState } from '../EmptyState';
import { PageHeader } from '../PageHeader';
import { Select } from '../Select';
import { Spinner } from '../Spinner';
import spinnerStyles from '../Spinner.module.css';

test('Card renderiza título en heading y children', () => {
  render(<Card title="Resumen">cuerpo</Card>);
  expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
  expect(screen.getByText('cuerpo')).toBeInTheDocument();
});

test('Select asocia label, lista opciones y muestra error', () => {
  render(
    <Select label="Especie" error="Elegí una">
      <option value="nogal">Nogal</option>
    </Select>,
  );
  expect(screen.getByLabelText('Especie')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('option', { name: 'Nogal' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Elegí una');
});

test('Spinner expone role status y la clase de tamaño', () => {
  render(<Spinner size="sm" />);
  expect(screen.getByRole('status').className).toContain(spinnerStyles.sm);
});

test('EmptyState muestra ícono, textos y CTA', () => {
  render(
    <EmptyState icon="🌱" title="Sin plantaciones" description="Creá la primera">
      <button>Crear</button>
    </EmptyState>,
  );
  expect(screen.getByText('Sin plantaciones')).toBeInTheDocument();
  expect(screen.getByText('Creá la primera')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument();
});

test('PageHeader renderiza h1, subtítulo y acciones', () => {
  render(
    <PageHeader title="Plantaciones" subtitle="Listado general">
      <button>Nueva</button>
    </PageHeader>,
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Plantaciones' })).toBeInTheDocument();
  expect(screen.getByText('Listado general')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Nueva' })).toBeInTheDocument();
});
