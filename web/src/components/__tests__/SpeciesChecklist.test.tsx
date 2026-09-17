import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaestroEspecies, SpeciesChecklist } from '../SpeciesChecklist';
import type { EstadoMaestro } from '../../lib/speciesChecklistSelection';
import type { EspecieCatalogo } from '../../queries/especieQueries';

const CATALOGO: EspecieCatalogo[] = [
  { id: 'sp-1', codigo: 'AL', nombre: 'Algarrobo', nombreCientifico: null },
  { id: 'sp-2', codigo: 'CE', nombre: 'Ceibo', nombreCientifico: 'Erythrina crista-galli' },
  { id: 'sp-3', codigo: 'QB', nombre: 'Quebracho', nombreCientifico: 'Schinopsis balansae' },
];

function renderChecklist(overrides?: {
  catalogo?: EspecieCatalogo[];
  habilitadas?: Set<string>;
  bloqueadas?: Set<string>;
  busqueda?: string;
  onToggle?: (id: string, habilitar: boolean) => void;
}) {
  const onToggle = overrides?.onToggle ?? vi.fn();
  render(
    <SpeciesChecklist
      catalogo={overrides?.catalogo ?? CATALOGO}
      habilitadas={overrides?.habilitadas ?? new Set(['sp-1'])}
      bloqueadas={overrides?.bloqueadas}
      onToggle={onToggle}
      busqueda={overrides?.busqueda ?? ''}
    />,
  );
  return onToggle;
}

test('marca las habilitadas y deja el nombre científico en el title', () => {
  renderChecklist();
  expect(screen.getByRole('checkbox', { name: 'Algarrobo' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Ceibo' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Ceibo' })).toHaveAttribute(
    'title',
    'Erythrina crista-galli',
  );
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
  expect(checkbox).toHaveAttribute('title', 'Tiene árboles registrados');
  // La marca visible dice por qué no se puede desmarcar.
  expect(screen.getByText('con árboles')).toBeInTheDocument();
  await usuario.click(checkbox);
  expect(onToggle).not.toHaveBeenCalled();
});

test('filtra el catálogo por la búsqueda (nombre/código/científico)', () => {
  renderChecklist({ busqueda: 'erythrina' });
  expect(screen.getByRole('checkbox', { name: 'Ceibo' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Algarrobo' })).not.toBeInTheDocument();
});

test('con catálogo no vacío pero búsqueda sin coincidencias muestra el "sin resultados"', () => {
  renderChecklist({ busqueda: 'zzz-no-existe' });
  expect(screen.getByText('Ninguna especie coincide con la búsqueda')).toBeInTheDocument();
  // Sin filas: ninguna especie del catálogo queda visible.
  expect(screen.queryByRole('checkbox', { name: 'Algarrobo' })).not.toBeInTheDocument();
});

test('con catálogo vacío no muestra el "sin resultados" (solo lista vacía)', () => {
  renderChecklist({ catalogo: [], habilitadas: new Set() });
  expect(screen.queryByText('Ninguna especie coincide con la búsqueda')).not.toBeInTheDocument();
});

function renderMaestro(estado: EstadoMaestro, deshabilitado = false, onMaestro = vi.fn()) {
  const utilidades = render(
    <MaestroEspecies estado={estado} deshabilitado={deshabilitado} onMaestro={onMaestro} />,
  );
  return { ...utilidades, onMaestro };
}

test('el maestro refleja el tri-estado con aria-checked (mixed/true/false)', () => {
  const { rerender } = renderMaestro('parcial');
  const maestro = () => screen.getByRole('checkbox', { name: 'Marcar todas' });
  expect(maestro()).toHaveAttribute('aria-checked', 'mixed');

  rerender(<MaestroEspecies estado="todas" deshabilitado={false} onMaestro={vi.fn()} />);
  expect(maestro()).toHaveAttribute('aria-checked', 'true');
  rerender(<MaestroEspecies estado="ninguna" deshabilitado={false} onMaestro={vi.fn()} />);
  expect(maestro()).toHaveAttribute('aria-checked', 'false');
});

test('el maestro llama onMaestro al hacer click', async () => {
  const usuario = userEvent.setup();
  const { onMaestro } = renderMaestro('parcial');
  await usuario.click(screen.getByRole('checkbox', { name: 'Marcar todas' }));
  expect(onMaestro).toHaveBeenCalledTimes(1);
});

test('el maestro queda deshabilitado cuando no hay filas visibles', () => {
  renderMaestro('ninguna', true);
  expect(screen.getByRole('checkbox', { name: 'Marcar todas' })).toBeDisabled();
});
