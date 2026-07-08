import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpeciesChecklist } from '../SpeciesChecklist';
import type { EspecieCatalogo } from '../../queries/especieQueries';

const CATALOGO: EspecieCatalogo[] = [
  { id: 'sp-1', codigo: 'AL', nombre: 'Algarrobo', nombreCientifico: null },
  { id: 'sp-2', codigo: 'CE', nombre: 'Ceibo', nombreCientifico: 'Erythrina crista-galli' },
  { id: 'sp-3', codigo: 'QB', nombre: 'Quebracho', nombreCientifico: 'Schinopsis balansae' },
];

function renderChecklist(overrides?: {
  habilitadas?: Set<string>;
  bloqueadas?: Set<string>;
  busqueda?: string;
  estadoMaestro?: 'todas' | 'ninguna' | 'parcial';
  onToggle?: (id: string, habilitar: boolean) => void;
  onMaestro?: () => void;
}) {
  const onToggle = overrides?.onToggle ?? vi.fn();
  render(
    <SpeciesChecklist
      catalogo={CATALOGO}
      habilitadas={overrides?.habilitadas ?? new Set(['sp-1'])}
      bloqueadas={overrides?.bloqueadas}
      onToggle={onToggle}
      estadoMaestro={overrides?.estadoMaestro ?? 'parcial'}
      onMaestro={overrides?.onMaestro ?? vi.fn()}
      busqueda={overrides?.busqueda ?? ''}
      onBuscar={vi.fn()}
    />,
  );
  return onToggle;
}

test('marca las habilitadas y muestra el nombre científico en itálica', () => {
  renderChecklist();
  expect(screen.getByRole('checkbox', { name: 'Algarrobo' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Ceibo' })).not.toBeChecked();
  expect(screen.getByText('Schinopsis balansae')).toBeInTheDocument();
});

test('togglear una especie no habilitada llama onToggle con habilitar=true', async () => {
  const usuario = userEvent.setup();
  const onToggle = renderChecklist();
  await usuario.click(screen.getByRole('checkbox', { name: 'Ceibo' }));
  expect(onToggle).toHaveBeenCalledWith('sp-2', true);
});

test('togglear una habilitada llama onToggle con habilitar=false', async () => {
  const usuario = userEvent.setup();
  const onToggle = renderChecklist();
  await usuario.click(screen.getByRole('checkbox', { name: 'Algarrobo' }));
  expect(onToggle).toHaveBeenCalledWith('sp-1', false);
});

test('una especie bloqueada está deshabilitada y no dispara onToggle', async () => {
  const usuario = userEvent.setup();
  const onToggle = renderChecklist({
    habilitadas: new Set(['sp-1']),
    bloqueadas: new Set(['sp-1']),
  });
  const checkbox = screen.getByRole('checkbox', { name: 'Algarrobo' });
  expect(checkbox).toBeDisabled();
  await usuario.click(checkbox);
  expect(onToggle).not.toHaveBeenCalled();
});

test('filtra el catálogo por la búsqueda (nombre/código/científico)', () => {
  renderChecklist({ busqueda: 'erythrina' });
  expect(screen.getByRole('checkbox', { name: 'Ceibo' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Algarrobo' })).not.toBeInTheDocument();
});

test('el maestro refleja el tri-estado con aria-checked (mixed/true/false)', () => {
  const { rerender } = render(
    <SpeciesChecklist
      catalogo={CATALOGO}
      habilitadas={new Set(['sp-1'])}
      onToggle={vi.fn()}
      estadoMaestro="parcial"
      onMaestro={vi.fn()}
      busqueda=""
      onBuscar={vi.fn()}
    />,
  );
  const maestro = () => screen.getByRole('checkbox', { name: 'Todas las especies' });
  expect(maestro()).toHaveAttribute('aria-checked', 'mixed');

  const props = {
    catalogo: CATALOGO,
    habilitadas: new Set(['sp-1']),
    onToggle: vi.fn(),
    onMaestro: vi.fn(),
    busqueda: '',
    onBuscar: vi.fn(),
  };
  rerender(<SpeciesChecklist {...props} estadoMaestro="todas" />);
  expect(maestro()).toHaveAttribute('aria-checked', 'true');
  rerender(<SpeciesChecklist {...props} estadoMaestro="ninguna" />);
  expect(maestro()).toHaveAttribute('aria-checked', 'false');
});

test('el maestro llama onMaestro al hacer click', async () => {
  const usuario = userEvent.setup();
  const onMaestro = vi.fn();
  renderChecklist({ onMaestro });
  await usuario.click(screen.getByRole('checkbox', { name: 'Todas las especies' }));
  expect(onMaestro).toHaveBeenCalledTimes(1);
});

test('el maestro queda deshabilitado con el catálogo vacío', () => {
  render(
    <SpeciesChecklist
      catalogo={[]}
      habilitadas={new Set()}
      onToggle={vi.fn()}
      estadoMaestro="ninguna"
      onMaestro={vi.fn()}
      busqueda=""
      onBuscar={vi.fn()}
    />,
  );
  expect(screen.getByRole('checkbox', { name: 'Todas las especies' })).toBeDisabled();
});
