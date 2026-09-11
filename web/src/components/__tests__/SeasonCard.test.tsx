import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { listarPlantaciones, type PlantacionConStats } from '../../queries/plantationQueries';
import { SeasonCard } from '../SeasonCard';

vi.mock('../../queries/plantationQueries', () => ({
  listarPlantaciones: vi.fn(),
  obtenerTemporadaActivaId: vi.fn(async () => 'p1'),
}));

function renderCard(arboles: number, objetivoArboles: number | null = null) {
  const temporada = { id: 'p1', lugar: 'Misiones', periodo: '2025-2026', arboles, objetivoArboles };
  vi.mocked(listarPlantaciones).mockResolvedValue([temporada as PlantacionConStats]);
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <SeasonCard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test.each([
  [0, '0 árboles'],
  [1, '1 árbol'],
  [2, '2 árboles'],
  [1000, '1.000 árboles'],
])('sin meta, el pie cuenta %i árboles: "%s"', async (arboles, texto) => {
  renderCard(arboles);

  expect(await screen.findByText(texto)).toBeInTheDocument();
});

test('con meta, el avance sigue al recuento', async () => {
  renderCard(1, 4);

  expect(await screen.findByText('1 árbol · 25%')).toBeInTheDocument();
});
