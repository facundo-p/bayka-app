import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERFIL_ADMIN, estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { renderRutasEn } from '../../test/renderConRutas';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

// Lo que `lib/novedades` deja pasar en staging: la sección en pruebas arriba.
vi.mock('../../lib/novedades', () => ({
  ENTRADAS: [
    {
      titulo: 'En pruebas · próxima versión',
      sincronizadoHasta: '5930146 #374',
      items: [
        {
          titular: 'Detalle al costado.',
          detalle: 'El árbol se abre sin tapar el listado.',
          pasos: ['Entrá a una plantación.', 'Esperá ver el detalle a la derecha.'],
        },
      ],
    },
    { titulo: 'Web 1.1.0 · 21 de agosto de 2026', items: [{ detalle: 'Ya publicado.' }] },
  ],
  FIRMA_NOVEDADES: 'v1.1.0 · 5930146 #374',
}));

beforeEach(() => {
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
  estadoMock.resolverConsulta = () => ({ data: [], error: null, count: 0 });
  window.localStorage.clear();
});

async function enMain() {
  return within(await screen.findByRole('main'));
}

test('la sección en pruebas avisa que todavía no está en producción', async () => {
  renderRutasEn('/novedades');

  const main = await enMain();
  expect(await main.findByRole('heading', { name: 'En pruebas · próxima versión' })).toBeInTheDocument();
  expect(main.getByText('Todavía no está en producción')).toBeInTheDocument();
  expect(main.getByRole('heading', { name: 'Web 1.1.0 · 21 de agosto de 2026' })).toBeInTheDocument();
});

test('los pasos de prueba arrancan plegados y se abren con "Cómo probarlo"', async () => {
  renderRutasEn('/novedades');

  const main = await enMain();
  const resumen = await main.findByText('Cómo probarlo');
  const desplegable = resumen.closest('details');
  expect(desplegable).not.toHaveAttribute('open');

  await userEvent.click(resumen);

  expect(desplegable).toHaveAttribute('open');
  expect(main.getByText('Entrá a una plantación.')).toBeVisible();
});

test('entrar guarda la firma con la marca de sincronización', async () => {
  renderRutasEn('/novedades');
  const main = await enMain();
  await main.findByRole('heading', { name: 'Novedades' });

  expect(window.localStorage.getItem('bayka.novedades.ultima-vista')).toBe('v1.1.0 · 5930146 #374');
});
